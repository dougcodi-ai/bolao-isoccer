-- Tabela de consentimentos LGPD
CREATE TABLE IF NOT EXISTS public.lgpd_consents (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    consent_type TEXT NOT NULL CHECK (consent_type IN (
        'essential',
        'analytics', 
        'marketing',
        'personalization',
        'third_party'
    )),
    granted BOOLEAN NOT NULL,
    granted_at TIMESTAMPTZ,
    revoked_at TIMESTAMPTZ,
    ip_address TEXT NOT NULL,
    user_agent TEXT NOT NULL,
    version TEXT NOT NULL DEFAULT '1.0',
    purpose TEXT NOT NULL,
    legal_basis TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tabela de registros de processamento de dados
CREATE TABLE IF NOT EXISTS public.lgpd_data_processing (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    data_type TEXT NOT NULL,
    processing_purpose TEXT NOT NULL,
    legal_basis TEXT NOT NULL,
    retention_period TEXT NOT NULL,
    third_parties TEXT[], -- Array de terceiros que recebem os dados
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tabela de solicitações de titulares de dados
CREATE TABLE IF NOT EXISTS public.lgpd_data_subject_requests (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    request_type TEXT NOT NULL CHECK (request_type IN (
        'access',
        'rectification', 
        'erasure',
        'portability',
        'restriction',
        'objection'
    )),
    status TEXT NOT NULL CHECK (status IN (
        'pending',
        'processing',
        'completed',
        'rejected'
    )) DEFAULT 'pending',
    requested_at TIMESTAMPTZ DEFAULT NOW(),
    completed_at TIMESTAMPTZ,
    details TEXT,
    response TEXT,
    processed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_lgpd_consents_user_id ON public.lgpd_consents(user_id);
CREATE INDEX IF NOT EXISTS idx_lgpd_consents_type ON public.lgpd_consents(consent_type);
CREATE INDEX IF NOT EXISTS idx_lgpd_consents_granted_at ON public.lgpd_consents(granted_at);

CREATE INDEX IF NOT EXISTS idx_lgpd_data_processing_user_id ON public.lgpd_data_processing(user_id);
CREATE INDEX IF NOT EXISTS idx_lgpd_data_processing_created_at ON public.lgpd_data_processing(created_at);

CREATE INDEX IF NOT EXISTS idx_lgpd_requests_user_id ON public.lgpd_data_subject_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_lgpd_requests_status ON public.lgpd_data_subject_requests(status);
CREATE INDEX IF NOT EXISTS idx_lgpd_requests_type ON public.lgpd_data_subject_requests(request_type);

-- RLS (Row Level Security)
ALTER TABLE public.lgpd_consents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lgpd_data_processing ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lgpd_data_subject_requests ENABLE ROW LEVEL SECURITY;

-- Políticas para consentimentos
CREATE POLICY "Users can view their own consents" ON public.lgpd_consents
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own consents" ON public.lgpd_consents
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can view all consents" ON public.lgpd_consents
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.profiles 
            WHERE profiles.id = auth.uid() 
            AND profiles.role = 'admin'
        )
    );

-- Políticas para processamento de dados
CREATE POLICY "Users can view their own data processing records" ON public.lgpd_data_processing
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "System can insert data processing records" ON public.lgpd_data_processing
    FOR INSERT WITH CHECK (true); -- Permitir inserção pelo sistema

CREATE POLICY "Admins can view all data processing records" ON public.lgpd_data_processing
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.profiles 
            WHERE profiles.id = auth.uid() 
            AND profiles.role = 'admin'
        )
    );

-- Políticas para solicitações de titulares
CREATE POLICY "Users can view their own requests" ON public.lgpd_data_subject_requests
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own requests" ON public.lgpd_data_subject_requests
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can manage all requests" ON public.lgpd_data_subject_requests
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.profiles 
            WHERE profiles.id = auth.uid() 
            AND profiles.role = 'admin'
        )
    );

-- Função para obter consentimento atual do usuário
CREATE OR REPLACE FUNCTION get_current_consent(p_user_id UUID, p_consent_type TEXT)
RETURNS BOOLEAN AS $$
DECLARE
    latest_consent RECORD;
BEGIN
    SELECT granted, revoked_at INTO latest_consent
    FROM public.lgpd_consents
    WHERE user_id = p_user_id 
    AND consent_type = p_consent_type
    ORDER BY granted_at DESC
    LIMIT 1;
    
    -- Se não há registro, retorna false
    IF NOT FOUND THEN
        RETURN FALSE;
    END IF;
    
    -- Se foi revogado, retorna false
    IF latest_consent.revoked_at IS NOT NULL THEN
        RETURN FALSE;
    END IF;
    
    RETURN latest_consent.granted;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Função para registrar processamento automático de dados
CREATE OR REPLACE FUNCTION auto_record_data_processing()
RETURNS TRIGGER AS $$
BEGIN
    -- Registrar processamento quando dados são inseridos/atualizados
    INSERT INTO public.lgpd_data_processing (
        user_id,
        data_type,
        processing_purpose,
        legal_basis,
        retention_period
    ) VALUES (
        COALESCE(NEW.user_id, NEW.owner_id), -- Usar user_id ou owner_id conforme disponível
        TG_TABLE_NAME,
        CASE TG_OP
            WHEN 'INSERT' THEN 'Criação de registro'
            WHEN 'UPDATE' THEN 'Atualização de registro'
            ELSE 'Processamento de dados'
        END,
        'Execução de contrato',
        CASE TG_TABLE_NAME
            WHEN 'profiles' THEN '2 anos após inatividade'
            WHEN 'booster_purchases' THEN '5 anos (obrigação fiscal)'
            WHEN 'predictions' THEN '1 ano após fim do bolão'
            ELSE '1 ano'
        END
    );
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers para registro automático de processamento
CREATE TRIGGER trigger_profiles_data_processing
    AFTER INSERT OR UPDATE ON public.profiles
    FOR EACH ROW
    WHEN (NEW.id IS NOT NULL)
    EXECUTE FUNCTION auto_record_data_processing();

CREATE TRIGGER trigger_purchases_data_processing
    AFTER INSERT OR UPDATE ON public.booster_purchases
    FOR EACH ROW
    WHEN (NEW.user_id IS NOT NULL)
    EXECUTE FUNCTION auto_record_data_processing();

-- Função para limpeza automática de dados expirados
CREATE OR REPLACE FUNCTION cleanup_expired_lgpd_data()
RETURNS void AS $$
BEGIN
    -- Limpar consentimentos antigos (manter apenas os últimos 2 anos)
    DELETE FROM public.lgpd_consents 
    WHERE granted_at < NOW() - INTERVAL '2 years';
    
    -- Limpar registros de processamento antigos (manter apenas 3 anos)
    DELETE FROM public.lgpd_data_processing 
    WHERE created_at < NOW() - INTERVAL '3 years';
    
    -- Limpar solicitações completadas antigas (manter apenas 1 ano)
    DELETE FROM public.lgpd_data_subject_requests 
    WHERE status = 'completed' 
    AND completed_at < NOW() - INTERVAL '1 year';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Função para anonimizar dados de usuário
CREATE OR REPLACE FUNCTION anonymize_user_data(p_user_id UUID)
RETURNS void AS $$
DECLARE
    anon_id TEXT;
BEGIN
    -- Gerar ID anônimo
    anon_id := 'anon_' || encode(gen_random_bytes(16), 'hex');
    
    -- Anonimizar referências em tabelas relacionadas
    UPDATE public.predictions SET user_id = anon_id::UUID WHERE user_id = p_user_id;
    UPDATE public.booster_purchases SET user_id = anon_id::UUID WHERE user_id = p_user_id;
    UPDATE public.pool_members SET user_id = anon_id::UUID WHERE user_id = p_user_id;
    
    -- Marcar perfil como removido
    UPDATE public.profiles SET 
        email = 'deleted_' || p_user_id || '@deleted.local',
        display_name = 'Usuário Removido',
        avatar_url = NULL,
        deleted_at = NOW()
    WHERE id = p_user_id;
    
    -- Registrar o processamento de anonimização
    INSERT INTO public.lgpd_data_processing (
        user_id,
        data_type,
        processing_purpose,
        legal_basis,
        retention_period
    ) VALUES (
        p_user_id,
        'all_personal_data',
        'Exercício do direito ao apagamento',
        'Solicitação do titular',
        'N/A - dados anonimizados'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Adicionar coluna deleted_at na tabela profiles se não existir
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'profiles' 
        AND column_name = 'deleted_at'
        AND table_schema = 'public'
    ) THEN
        ALTER TABLE public.profiles 
        ADD COLUMN deleted_at TIMESTAMPTZ;
        
        -- Criar índice para deleted_at
        CREATE INDEX IF NOT EXISTS idx_profiles_deleted_at ON public.profiles(deleted_at);
    END IF;
END $$;