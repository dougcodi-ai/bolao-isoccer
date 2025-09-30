// Type definitions for Next.js routes

/**
 * Internal types used by the Next.js router and Link component.
 * These types are not meant to be used directly.
 * @internal
 */
declare namespace __next_route_internal_types__ {
  type SearchOrHash = `?${string}` | `#${string}`
  type WithProtocol = `${string}:${string}`

  type Suffix = '' | SearchOrHash

  type SafeSlug<S extends string> = S extends `${string}/${string}`
    ? never
    : S extends `${string}${SearchOrHash}`
    ? never
    : S extends ''
    ? never
    : S

  type CatchAllSlug<S extends string> = S extends `${string}${SearchOrHash}`
    ? never
    : S extends ''
    ? never
    : S

  type OptionalCatchAllSlug<S extends string> =
    S extends `${string}${SearchOrHash}` ? never : S

  type StaticRoutes = 
    | `/`
    | `/admin/security`
    | `/api/admin/security/audit`
    | `/api/admin/security/stats`
    | `/api/admin/security/export`
    | `/api/admin/security/events`
    | `/api/boosters/activate`
    | `/api/boosters/cron-expire`
    | `/api/boosters/use`
    | `/api/championships`
    | `/api/cron/auto-pick`
    | `/api/dev/seed-matches`
    | `/api/dev/create-pools`
    | `/api/dev/seed-pool`
    | `/api/example/secure-predictions`
    | `/api/football/fixtures`
    | `/api/football/seed`
    | `/api/football/team-lookup`
    | `/api/football/standings`
    | `/api/football/validate`
    | `/api/football/teams`
    | `/api/matches`
    | `/api/mock/football`
    | `/api/setIsSelect`
    | `/api/stripe/checkout`
    | `/api/stripe/checkout/booster`
    | `/api/stripe/checkout/upgrade`
    | `/api/stripe/session/verify`
    | `/api/stripe/webhook`
    | `/api/store/products`
    | `/api/store/upgrades`
    | `/api/pools/ensure-matches`
    | `/api/test/booster/activate`
    | `/api/test/realtime`
    | `/api/jobs/sync-team-logos`
    | `/auth/cadastro`
    | `/auth/confirm`
    | `/auth/forgot`
    | `/auth/login`
    | `/auth/reset`
    | `/bolao/entrar`
    | `/bolao/criar`
    | `/bolao/meus`
    | `/boosters`
    | `/dashboard`
    | `/loja`
    | `/pagamento/cancelado`
    | `/pagamento/sucesso`
    | `/perfil`
    | `/ranking`
    | `/regras`
    | `/test/booster`
    | `/palpites`
    | `/test-auth`
    | `/test-protected`
  type DynamicRoutes<T extends string = string> = 
    | `/api/mock/football/${CatchAllSlug<T>}`
    | `/api/pools/${SafeSlug<T>}/ensure-matches`
    | `/api/pools/${SafeSlug<T>}/match-performance`
    | `/api/pools/${SafeSlug<T>}/friends-predictions`
    | `/api/pools/${SafeSlug<T>}/predictions`
    | `/api/pools/${SafeSlug<T>}/predictions/undo`
    | `/api/pools/${SafeSlug<T>}/recompute-points`

  type RouteImpl<T> = 
    | StaticRoutes
    | SearchOrHash
    | WithProtocol
    | `${StaticRoutes}${SearchOrHash}`
    | (T extends `${DynamicRoutes<infer _>}${Suffix}` ? T : never)
    
}

declare module 'next' {
  export { default } from 'next/types/index.js'
  export * from 'next/types/index.js'

  export type Route<T extends string = string> =
    __next_route_internal_types__.RouteImpl<T>
}

declare module 'next/link' {
  import type { LinkProps as OriginalLinkProps } from 'next/dist/client/link.js'
  import type { AnchorHTMLAttributes, DetailedHTMLProps } from 'react'
  import type { UrlObject } from 'url'

  type LinkRestProps = Omit<
    Omit<
      DetailedHTMLProps<
        AnchorHTMLAttributes<HTMLAnchorElement>,
        HTMLAnchorElement
      >,
      keyof OriginalLinkProps
    > &
      OriginalLinkProps,
    'href'
  >

  export type LinkProps<RouteInferType> = LinkRestProps & {
    /**
     * The path or URL to navigate to. This is the only required prop. It can also be an object.
     * @see https://nextjs.org/docs/api-reference/next/link
     */
    href: __next_route_internal_types__.RouteImpl<RouteInferType> | UrlObject
  }

  export default function Link<RouteType>(props: LinkProps<RouteType>): JSX.Element
}

declare module 'next/navigation' {
  export * from 'next/dist/client/components/navigation.js'

  import type { NavigateOptions, AppRouterInstance as OriginalAppRouterInstance } from 'next/dist/shared/lib/app-router-context.shared-runtime.js'
  interface AppRouterInstance extends OriginalAppRouterInstance {
    /**
     * Navigate to the provided href.
     * Pushes a new history entry.
     */
    push<RouteType>(href: __next_route_internal_types__.RouteImpl<RouteType>, options?: NavigateOptions): void
    /**
     * Navigate to the provided href.
     * Replaces the current history entry.
     */
    replace<RouteType>(href: __next_route_internal_types__.RouteImpl<RouteType>, options?: NavigateOptions): void
    /**
     * Prefetch the provided href.
     */
    prefetch<RouteType>(href: __next_route_internal_types__.RouteImpl<RouteType>): void
  }

  export declare function useRouter(): AppRouterInstance;
}
