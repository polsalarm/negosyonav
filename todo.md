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
