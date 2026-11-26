# 大黄书 · 墨金 Design System

Stitch project: projects/12141898803755709269
Asset: assets/9708645926523801275

## Tokens
- Primary amber: #C9920A (CTA / active)
- Ink: #1C1C18
- Soft ink: #504534
- Surface: #FCF9F2
- Card: #FFFCF7 / #F6F3EC
- Pine success: #0F6B52
- Radius: 8px
- Headline: Literata
- Body: Plus Jakarta Sans

## Screens
- Home: screens/88c8459481cb44e0ba469a0605b0813c
- Wallet: screens/995dc451be8c4d459b05c6fb7f89dd44
- Mine: screens/bf08a87a64d54427ad50ce5d47f0d9ca
- Browse: screens/dc20e74e2b754fa39cf1fe87343753cf
- Login: screens/d852f09593ba44c79e725ab3c6bbfa3d
- Pay success: screens/f0ac62b3cb2f49beaf87771ff3a35ffa

## Mobile sync (local)
- max-width 879px: tighter wrap/topbar, hero CTAs full-width row, pack cards, tab icons
- `/pay/*` hides tabbar; sticky pay-wait dock (打开支付 / 我已完成支付)
- Phone pay: same-tab open cashier; return via system back + poll
