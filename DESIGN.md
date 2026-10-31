# VendorIQ design system

VendorIQ is an operations console used all day by a procurement team, plus a short public form for suppliers.
Mode: **Operate**. Scanning, consistency and density matter more than expression.

Dials: design variance 3, motion 2, visual density 6.

## Reference lock

| | |
|---|---|
| Primary | **IBM Carbon**: flat, square, hairline-separated gray layers, one blue accent, IBM Plex |
| Borrowed, narrowly | Linear: dense list rows are the container for queues (no card per item). Stripe: fixed-width digits wherever numbers are compared |
| Refused | Rounded soft cards with shadow, hero-metric tiles, uppercase eyebrow labels, coloured side stripes, ring and donut charts, an entrance animation on every panel, Lucide as the icon set, em-dashes in copy |

## Tokens (`src/app/globals.css`)

- **Layers**: page `#f4f4f4`, panel white, hairline `#e0e0e0`. Dark theme uses Carbon Gray 100 (`#161616` page, `#1e1e1e` panel).
- **One accent**: `#0f62fe`. `action` fills buttons (white text, 5.3:1); `brand` colours links and selection (lighter in dark mode).
- **Status**: green, yellow, orange, red tints for tags. Always an icon or a label as well, never colour alone.
- **Channels** (portal, email, form): `#0f62fe / #c45a00 / #00907f` light, `#4589ff / #e0701c / #10a08c` dark. Validated for colour-blind separation and 3:1 contrast against the surface.
- **Type**: IBM Plex Sans, IBM Plex Mono for IDs and codes. One scale: 12 / 13 / 14 / 16 / 20 / 28 px. Body is 14px. Tables use tabular figures.
- **Corners**: 2px everywhere. Pills only for tags and avatars.
- **Depth**: a border. The only shadow is for things that float (menus, dialogs).
- **Motion**: state changes only. 120-180ms, `cubic-bezier(0.23, 1, 0.32, 1)`. One short fade for things that appear. Reduced motion is respected.
- **Spacing**: 4px base. Panels pad 16, sections are 24 apart.

## Components

- Buttons are 40px (32px small), square, one filled primary per view. Secondary has a 1px border.
- Fields are Carbon-style: filled, bottom border only, 2px inset ring on focus.
- Tables and queues: header row on the lower gray layer, 40-56px rows, the whole row is the link.
- Panels have a title bar with the title and an optional one-line subtitle. No icon beside titles.
- Tabs are underlined, with counts.
- Icons come from Carbon, imported through `src/components/icons.tsx`. Swap the family there.

## Decision ledger

| Decision | Source | Why |
|---|---|---|
| Square, flat, hairline panels | Carbon | Reads as enterprise software; the old rounded cards with shadows were the generic part |
| Status strip instead of six metric tiles | craft-floor "hero-metric template" | Same counts, but as links into the lists they describe |
| Work queues lead the Overview | impeccable Operate mode | The first question is "what do I need to do" |
| Segmented bar for channels, no donut or ring | refero anti-slop, craft-floor | A bar compares three shares exactly and carries direct labels |
| No labels above headings | craft-floor (a ban, not a default) | Headings carry their own weight |
| Status colour in a tinted header, not a stripe | craft-floor (stripe above 1px) | A stripe is decoration; the fill plus icon plus label is the signal |
| Sidebar has its own tokens (light blue-gray, near-black in dark) | user request | Different surfaces for light and dark |
| Fixed type scale, no half-pixel sizes | impeccable typeset | Hierarchy from a few clear steps |
| Carbon icons | frontend-designer | Lucide is the default shadcn look |

## Extending

Add a colour or size as a token first, then use it. A new page should reuse `PageHeader`, `Card`, `CardHeader`,
`Button`, `Badge`, `StatusPill` and the row patterns in `src/app/(console)/review/page.tsx`.
