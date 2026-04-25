# NegosyoNav v2 TODO

## Phase 1: Upgrade to Full-Stack
- [x] Run webdev_add_feature with web-db-user
- [x] Set up database schema for users, roadmaps, community_posts, post_votes, feedback
- [x] Configure LLM API for Taglish chat
- [x] Verify all 5 tables exist in remote DB and schema is synced via Drizzle

## Phase 2: AI-Powered Taglish Chat
- [x] Create backend tRPC mutation (ai.chat) with LLM integration
- [x] Include system prompt with full Manila LGU data context (5 steps, RDOs, grants, offices)
- [x] Replace template-based responses with real AI-generated responses
- [x] AI responds in Taglish with Manila-specific business registration guidance

## Phase 3: Negosyante Hub (Community Board)
- [x] Create community_posts and post_votes database tables
- [x] Build community board UI with Reddit-style layout (Hub.tsx)
- [x] Add LGU tag filtering (category filter: Lahat, Tips, Babala, Tanong, Kwento)
- [x] Add upvote/downvote functionality with toggle/switch logic
- [x] Add fixer warning badges (FIXER WARNING on warning-category posts)
- [x] Add post creation form (modal with category, title, content)
- [x] Add seed data for demo (4 posts from Aling Rosa, Kuya Ben, Maria Santos, Tatay Jun)

## Phase 4: Document Checklist & Feedback
- [x] Add interactive document checklist per step (19 documents across 5 steps)
- [x] Add feedback mechanism (report outdated info, incorrect data, suggestions)
- [x] Feedback modal with type selector, step selector, and message textarea
- [x] Add roadmap rating feature (star rating after completing 3+ steps)

## Phase 5: Fix Roadmap Inline Tasks
- [x] Move document requirements INTO each registration step as inline checkable tasks
- [x] Users must complete all requirements for a step before it shows as "done"
- [x] Remove the separate Document Checklist section at the bottom
- [x] Step progress shows "X of Y requirements ready" per step

## Phase 6: Smart Form Auto-fill + PDF Download (Feature 03 - MVP Anchor)
- [x] Research actual DTI application form fields (FM-BN-01, 33 fields)
- [x] Research actual Barangay Clearance form fields
- [x] Research actual BIR Form 1901 fields (39+ fields across 6 parts)
- [x] Build Negosyante Profile onboarding form (name, birthday, address, business name, type, barangay, TIN)
- [x] Store profile in database (negosyante_profiles table)
- [x] Extract profile data from chat conversation via LLM (sessionStorage + extractProfile mutation)
- [x] Build form auto-fill preview page per government form (DTI, Barangay, BIR 1901)
- [x] Generate print-ready content with pre-populated fields
- [x] "I-download" button for each form
- [ ] Works offline after generation (PWA stretch goal — not yet implemented, would need service worker + cache strategy)

## Phase 7: Grant & Livelihood Matching (Feature 04)
- [x] Auto-check user profile against LGU grants, DOLE programs, Negosyo Center funds
- [x] Surface alert cards automatically when user is eligible
- [x] No manual search needed — matching happens on profile completion
- [x] Grant matching page with BMBE, DOLE DILP, SB Corp programs

## Phase 8: Remaining Features (06-09)
- [x] Feature 06: Time-based task planner (Planner.tsx - select available time, shows doable steps, office hours awareness, online tasks 24/7, suggested schedule)
- [x] Feature 07: Smart place finder (office cards with queue tips, best times, Google Maps links)
- [x] Feature 08: Registration cost estimator (itemized breakdown in roadmap)
- [x] Feature 09: Renewal & deadline calendar (tracks deadlines with countdown, tips, penalties)

## Phase 9: Navigation & UX
- [x] Bottom navigation bar (Chat, Roadmap, Forms, Hub, Profile)
- [x] Fix chat input overlap with bottom nav
- [x] All pages accessible from bottom nav or roadmap
- [x] More Tools grid on Roadmap page (Auto-fill Forms, Grant Matching, Place Finder, Renewal Calendar, Task Planner)
- [x] Chat history persisted to sessionStorage for profile extraction
- [x] 18 vitest tests passing (grants, forms, feedback, community, auth)
