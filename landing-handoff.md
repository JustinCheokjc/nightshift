# Landing page hand-off for developers

The landing page is a single HTML prototype. These items need a real build.

## Replace before launch
- **Brand name:** change `BRAND` at the top of the script. Check domain, trademark and social handle availability first.
- **Contact email:** change `CONTACT` (currently hello@example.com) in the script and the About page.
- **Founder details:** add photo, bio and LinkedIn link on the About page.
- **Privacy notice and consent form:** replace the draft wording with text reviewed by a qualified adviser (PDPA). Fill the `[X]`, `[region]` and `[provider]` placeholders.

## Connect the sign-up form
- The prototype cannot send data to other sites. Set `FORM_URL` to a real endpoint (Tally, Airtable, Google Forms proxy or your own API) on the production host.
- Send an automatic confirmation email, and store the consent timestamp and policy version with each sign-up.

## Analytics
- The page already emits events via `track()` into `window.dataLayer` and an optional `window.NS_TRACK(event)` hook.
- Events: `tab_view`, `cta_click`, `calc_used`, `eligibility_complete`, `scroll_depth`, `screen_view`, `form_submit`.
- Connect a privacy-friendly tool (Plausible, PostHog or GA4). Add a cookie or consent notice if the tool needs one.
- A/B test the headline with `?h=b`. Show a waitlist count only once it is real.

## Real routes and SEO
- Rebuild the tabs as real pages: /, /contributors, /buyers, /trust, /about, /join (Astro, Next.js or similar).
- Give each page its own title, meta description, Open Graph image and sitemap entry.

## Quality checks
- Test on real iPhone and Android devices. On narrow screens and with reduced motion, the "day" story uses a slider instead of the pinned scroll.
- Run a contrast and screen-reader pass (Lighthouse, axe, VoiceOver).
- Keep "planned" labels on anything not yet built. Do not publish earnings figures until the pilot produces measured data.

## Updates
- **Logo:** `logo-mark.svg`, `logo-horizontal.svg` (dark text) and `logo-horizontal-light.svg` (light text). The wordmark is live text in Inter, so a designer should convert it to outlines and export PNGs before final use. Regenerate the wordmark if the name changes.
- **Market prices** now live on the Buyers page (the separate Pricing tab was removed), and the FAQ lives on About.
- **3D scene** loads Three.js only when the section is about to scroll into view. For production, self-host a pinned build and consider a static fallback image.
