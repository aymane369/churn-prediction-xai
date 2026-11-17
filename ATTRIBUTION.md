# Attribution and licences

Third-party assets and libraries used by the Tessera front end. Licences below were read from each
package's own metadata (`node_modules/<package>/package.json`) at the versions listed.

## Assets

| Asset | Source | Licence | Notes |
|---|---|---|---|
| Customer avatars | [DiceBear](https://www.dicebear.com/) "Lorelei" style by Lisa Wischofsky | **CC0 1.0** (public domain dedication) | Generated locally in the browser from each customer's `avatar_seed` with `@dicebear/core` (MIT). No request leaves the app. Attribution is not required for CC0 but is given here. |
| Manrope (UI typeface) | Mikhail Sharanda, via [Fontsource](https://fontsource.org/) | SIL Open Font Licence 1.1 | Self-hosted (`@fontsource-variable/manrope`); no Google Fonts requests. |
| Fraunces (editorial typeface) | Undercase Type (Phaedra Charles, Flavia Zimbardi), via Fontsource | SIL Open Font Licence 1.1 | Self-hosted (`@fontsource-variable/fraunces`), roman and italic, optical-size axis. |
| Icons | [Lucide](https://lucide.dev/) | ISC | `lucide-react`. |
| Logo mark, hero visual, gauge, charts | Original to this project | n/a | Drawn in SVG/CSS; no stock imagery. |

The grain texture is an inline SVG `feTurbulence` filter (generated, not an image file).

## Resources considered and not used

| Resource | Why not |
|---|---|
| Spline | A scene has to be authored in Spline's editor, which was not possible here, and reusing a community scene would raise licence questions. The hero is an original, lightweight SVG/DOM visualisation instead, with no 3D runtime shipped. |
| Icons8 Ouch, Unsplash, Iconify | No third-party illustrations or photographs were needed; avatars and icons cover the illustration needs. |
| Satoshi / Fontshare | Manrope was used for the UI face instead, because it is available as a self-hostable npm package under OFL. |

## Design references

The five reference mockups supplied for this project were used as visual inspiration only (type
pairing, atmosphere, segmented gauge, tinted profile header). No images, layouts or code were copied.

## Libraries (direct dependencies)

| Package | Version | Licence |
|---|---|---|
| react, react-dom | 19.3.1 | MIT |
| react-router-dom | 7.18.5 | MIT |
| @tanstack/react-query | 5.108.0 | MIT |
| motion | 14.14.0 | MIT |
| recharts | 3.10.1 | MIT |
| @dicebear/core, @dicebear/lorelei (code) | 9.4.3 / 9.4.2 | MIT |
| radix-ui | 1.8.1 | MIT |
| lucide-react | 1.74.0 | ISC |
| class-variance-authority | 0.7.1 | Apache-2.0 |
| clsx | 2.1.1 | MIT |
| tailwind-merge | 3.7.0 | MIT |
| @fontsource-variable/manrope, /fraunces | 5.3.0 | OFL-1.1 |

Development tooling (Vite, Tailwind CSS, TypeScript, Vitest, the React plugin, `tw-animate-css`) is
MIT-licensed and is not shipped to users.

The components in `frontend/src/components/ui/` come from [shadcn/ui](https://ui.shadcn.com/) (MIT),
copied into the repository and restyled to the Tessera design tokens.

## Data

The customer data is the public IBM Telco Customer Churn sample dataset. All customers are
pseudonymous: usernames and avatars are generated and do not identify real people.
