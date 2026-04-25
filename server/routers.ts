import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, protectedProcedure, router } from "./_core/trpc";
import { invokeLLM } from "./_core/llm";
import { z } from "zod";
import { getCommunityPosts, createCommunityPost, voteOnPost, getUserVotes, createFeedback, getProfile, upsertProfile } from "./db";

// Manila LGU context for the AI system prompt
const MANILA_SYSTEM_PROMPT = `You are NegosyoNav, a friendly and knowledgeable AI assistant that helps Filipino micro-entrepreneurs navigate business registration in the City of Manila. You speak in Taglish (mix of Tagalog and English) naturally.

IMPORTANT CONTEXT - City of Manila Business Registration Steps:

STEP 1: DTI Business Name Registration
- Agency: Department of Trade and Industry (DTI)
- Where: Online via bnrs.dti.gov.ph OR Negosyo Center, Manila City Hall
- Cost: ₱530 (₱500 registration + ₱30 documentary stamp)
- Processing: 1 day | Valid: 5 years
- Requirements: DTI application form, Valid government-issued ID
- Tips: Check name availability first online. Business name must be unique.

STEP 2: Barangay Business Clearance
- Agency: Barangay Hall (based on business address)
- Cost: ₱200–₱1,000 (varies per barangay)
- Processing: 1 day | Valid: 1 year
- Requirements: DTI Certificate, Valid ID, Proof of Address (Lease/Title)
- Tips: Manila has 897 barangays. Bring originals + photocopies.

STEP 3: Community Tax Certificate (Cedula)
- Agency: Manila City Treasurer's Office
- Where: Manila City Hall OR online via cedula.ctomanila.com
- Cost: ₱59–₱500
- Processing: 1 day | Valid: 1 year
- Tips: Online application available to save time.

STEP 4: Mayor's Permit / Business Permit
- Agency: Bureau of Permits, Manila City Hall
- Where: Room 110, Manila City Hall / E-BOSS Lounge, G/F
- Cost: ₱2,000–₱5,000
- Processing: 1-3 days | Valid: 1 year (renew by Jan 20)
- Requirements: DTI Cert, Barangay Clearance, Cedula, Lease Contract, Sanitary Permit, Fire Safety Certificate
- Tips: Go to E-BOSS Lounge for faster processing. Late renewal = 25% surcharge + 2% monthly interest.

STEP 5: BIR Registration
- Agency: Bureau of Internal Revenue (BIR)
- Where: Online via orus.bir.gov.ph OR assigned RDO
- Cost: ₱2,730–₱5,530 (DST ₱30, Books ₱200-500, Receipts ₱2,500-5,000)
- Processing: 1-3 days
- Requirements: BIR Form 1901, DTI Cert, Mayor's Permit, Valid ID, Proof of address
- Tips: Register within 30 days of DTI registration. Annual Registration Fee abolished since 2024.

Manila BIR RDOs:
- RDO 029: Tondo, San Nicolas
- RDO 030: Binondo
- RDO 031: Sta. Cruz
- RDO 032: Quiapo, Sampaloc, San Miguel, Sta. Mesa
- RDO 033: Intramuros, Ermita, Malate, Port Area (181 Natividad Lopez St)
- RDO 034: Paco, Pandacan, Sta. Ana, San Andres

TOTAL ESTIMATED COST: ₱5,519 – ₱12,560

GRANT PROGRAMS:
1. BMBE Registration - Total assets ≤ ₱3M = income tax exemption, minimum wage exemption, local tax reductions
2. DOLE Kabuhayan (DILP) - Starter Kit up to ₱20,000, Group grants ₱250K-₱1M
3. SB Corp Micro-Financing - Loans for existing MSMEs

KEY OFFICES:
- Manila City Hall Bureau of Permits: Room 110, Padre Burgos Ave, Ermita, Manila 1000 | +63 2 5310 4184
- Negosyo Center Manila: Manila City Hall | ncr@dti.gov.ph
- Negosyo Center Lucky Chinatown: Lucky Chinatown Mall, Binondo | 7794-2147

BEHAVIOR RULES:
- Always respond in Taglish (natural mix of Filipino and English)
- Be warm, encouraging, and supportive — these are first-time entrepreneurs
- When the user describes their business, identify: business type, district/barangay, and generate their personalized Lakad Roadmap
- Always mention relevant grants they may qualify for (especially BMBE for micro-enterprises)
- If asked about a city other than Manila, say "Pasensya na, Manila City pa lang ang available namin ngayon. Pero malapit na ang ibang cities!"
- Keep responses concise but informative
- Use peso sign (₱) for all amounts
- Encourage them — "Kaya mo 'to!" spirit`;

const PROFILE_EXTRACTION_PROMPT = `You are a data extraction assistant. Extract personal and business information from the chat conversation to fill a Negosyante Profile. Return ONLY a valid JSON object with these fields (use null for unknown):
{
  "firstName": string|null,
  "lastName": string|null,
  "middleName": string|null,
  "businessName": string|null,
  "businessType": string|null,
  "businessActivity": string|null,
  "bizBarangay": string|null,
  "bizCity": string|null,
  "mobileNumber": string|null,
  "emailAddress": string|null,
  "capitalization": number|null,
  "numberOfEmployees": number|null
}
Only include fields that were explicitly mentioned in the conversation. Return valid JSON only, no markdown.`;

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
  }),

  // AI Chat - Taglish conversational intake
  ai: router({
    chat: publicProcedure
      .input(z.object({
        messages: z.array(z.object({
          role: z.enum(["user", "assistant"]),
          content: z.string(),
        })),
      }))
      .mutation(async ({ input }) => {
        const llmMessages = [
          { role: "system" as const, content: MANILA_SYSTEM_PROMPT },
          ...input.messages.map(m => ({
            role: m.role as "user" | "assistant",
            content: m.content,
          })),
        ];

        const response = await invokeLLM({ messages: llmMessages });
        const content = response.choices[0]?.message?.content;
        const text = typeof content === "string" ? content : Array.isArray(content) ? content.map(c => 'text' in c ? c.text : '').join('') : '';
        return { content: text };
      }),

    // Extract profile data from chat conversation
    extractProfile: publicProcedure
      .input(z.object({
        messages: z.array(z.object({
          role: z.enum(["user", "assistant"]),
          content: z.string(),
        })),
      }))
      .mutation(async ({ input }) => {
        const chatSummary = input.messages.map(m => `${m.role}: ${m.content}`).join('\n');
        const response = await invokeLLM({
          messages: [
            { role: "system", content: PROFILE_EXTRACTION_PROMPT },
            { role: "user", content: chatSummary },
          ],
        });
        const content = response.choices[0]?.message?.content;
        const text = typeof content === "string" ? content : '';
        try {
          const cleaned = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
          return JSON.parse(cleaned);
        } catch {
          return {};
        }
      }),
  }),

  // Negosyante Profile
  profile: router({
    get: protectedProcedure.query(async ({ ctx }) => {
      return getProfile(ctx.user.id);
    }),

    save: protectedProcedure
      .input(z.object({
        firstName: z.string().optional(),
        middleName: z.string().optional(),
        lastName: z.string().optional(),
        suffix: z.string().optional(),
        dateOfBirth: z.string().optional(),
        gender: z.enum(["male", "female"]).optional(),
        civilStatus: z.enum(["single", "married", "widowed", "legally_separated"]).optional(),
        citizenship: z.string().optional(),
        placeOfBirth: z.string().optional(),
        mothersName: z.string().optional(),
        fathersName: z.string().optional(),
        tin: z.string().optional(),
        philsysId: z.string().optional(),
        mobileNumber: z.string().optional(),
        phoneNumber: z.string().optional(),
        emailAddress: z.string().optional(),
        homeBuilding: z.string().optional(),
        homeStreet: z.string().optional(),
        homeBarangay: z.string().optional(),
        homeCity: z.string().optional(),
        homeProvince: z.string().optional(),
        homeRegion: z.string().optional(),
        homeZipCode: z.string().optional(),
        businessName: z.string().optional(),
        businessNameOption2: z.string().optional(),
        businessNameOption3: z.string().optional(),
        businessType: z.string().optional(),
        businessActivity: z.string().optional(),
        territorialScope: z.enum(["barangay", "city", "regional", "national"]).optional(),
        bizBuilding: z.string().optional(),
        bizStreet: z.string().optional(),
        bizBarangay: z.string().optional(),
        bizCity: z.string().optional(),
        bizProvince: z.string().optional(),
        bizRegion: z.string().optional(),
        bizZipCode: z.string().optional(),
        capitalization: z.number().optional(),
        expectedAnnualSales: z.enum(["micro", "small", "medium", "large"]).optional(),
        numberOfEmployees: z.number().optional(),
        preferTaxOption: z.enum(["graduated", "eight_percent"]).optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        return upsertProfile(ctx.user.id, input);
      }),
  }),

  // Grant Matching
  grants: router({
    check: publicProcedure
      .input(z.object({
        capitalization: z.number().optional(),
        businessType: z.string().optional(),
        numberOfEmployees: z.number().optional(),
      }).optional())
      .query(({ input }) => {
        const grants: Array<{
          id: string;
          name: string;
          eligible: boolean;
          reason: string;
          benefits: string[];
          agency: string;
          whereToApply: string;
        }> = [];

        const cap = input?.capitalization ?? 0;
        const employees = input?.numberOfEmployees ?? 0;

        // BMBE
        grants.push({
          id: "bmbe",
          name: "BMBE Registration (Barangay Micro Business Enterprise)",
          eligible: cap <= 3000000,
          reason: cap <= 3000000
            ? `Total assets ₱${cap.toLocaleString()} is within ₱3M BMBE threshold`
            : `Total assets ₱${cap.toLocaleString()} exceeds ₱3M BMBE threshold`,
          benefits: [
            "Income tax exemption on business income",
            "Minimum wage law exemption",
            "Local tax and permit fee reductions",
            "Priority access to credit from banks",
            "Free training from DTI, TESDA, DOST",
          ],
          agency: "Manila City Treasurer's Office / DTI",
          whereToApply: "Manila City Treasurer's Office, Manila City Hall",
        });

        // DOLE DILP
        grants.push({
          id: "dole_dilp",
          name: "DOLE Kabuhayan Program (DILP)",
          eligible: true,
          reason: "Open to self-employed, displaced workers, women, youth, PWDs, senior citizens",
          benefits: [
            "Individual Starter Kit / Nego-Kart up to ₱20,000",
            "Group grants from ₱250,000 to ₱1,000,000",
          ],
          agency: "Department of Labor and Employment (DOLE)",
          whereToApply: "DOLE NCR Field Office",
        });

        // SB Corp
        grants.push({
          id: "sbcorp",
          name: "SB Corp Micro-Financing",
          eligible: cap > 0,
          reason: cap > 0
            ? "For existing MSMEs looking to expand"
            : "Requires an existing business with capitalization",
          benefits: [
            "Loan from ₱50,000 to ₱3,000,000",
            "0% interest for the first 12 months",
            "Up to 3 years payable with 6-month grace period",
          ],
          agency: "Small Business Corporation (DTI)",
          whereToApply: "SB Corp (sbcorp.gov.ph)",
        });

        return grants;
      }),
  }),

  // Community Hub - Negosyante Hub
  community: router({
    list: publicProcedure
      .input(z.object({
        lguTag: z.string().optional(),
      }).optional())
      .query(async ({ input }) => {
        return getCommunityPosts(input?.lguTag);
      }),

    create: protectedProcedure
      .input(z.object({
        title: z.string().min(5).max(500),
        content: z.string().min(10),
        category: z.enum(["tip", "warning", "question", "experience"]),
        lguTag: z.string().default("manila_city"),
      }))
      .mutation(async ({ ctx, input }) => {
        await createCommunityPost({
          userId: ctx.user.id,
          authorName: ctx.user.name || "Anonymous Negosyante",
          title: input.title,
          content: input.content,
          category: input.category,
          lguTag: input.lguTag,
        });
        return { success: true };
      }),

    vote: protectedProcedure
      .input(z.object({
        postId: z.number(),
        voteType: z.enum(["up", "down"]),
      }))
      .mutation(async ({ ctx, input }) => {
        return voteOnPost(input.postId, ctx.user.id, input.voteType);
      }),

    myVotes: protectedProcedure
      .query(async ({ ctx }) => {
        return getUserVotes(ctx.user.id);
      }),
  }),

  // Smart Form Auto-fill + PDF Generation
  forms: router({
    generatePdf: protectedProcedure
      .input(z.object({
        formId: z.string(),
        fields: z.record(z.string(), z.string()),
      }))
      .mutation(async ({ input }) => {
        // Generate a simple text-based PDF content as base64
        // In production, this would use a proper PDF library
        const formTitles: Record<string, string> = {
          dti_form: "DTI Business Name Registration Form (FM-BN-01)",
          barangay_clearance: "Barangay Business Clearance Application",
          bir_1901: "BIR Form 1901 — Application for Registration",
        };
        const title = formTitles[input.formId] || input.formId;
        
        // Build a simple text representation for the PDF
        let textContent = `${title}\n${'='.repeat(60)}\n\n`;
        textContent += `Generated by NegosyoNav | Date: ${new Date().toLocaleDateString('en-PH')}\n\n`;
        
        for (const [key, value] of Object.entries(input.fields)) {
          const label = key.replace(/_/g, ' ').replace(/^(dti|bir|brgy)\s/, '').toUpperCase();
          textContent += `${label}: ${value || '(blank)'}\n`;
        }
        
        textContent += `\n${'='.repeat(60)}\n`;
        textContent += `IMPORTANT: This is a pre-filled reference document.\n`;
        textContent += `Please transfer the information to the official government form.\n`;
        textContent += `Official DTI form: bnrs.dti.gov.ph\n`;
        textContent += `Official BIR form: bir.gov.ph\n`;
        
        // Encode as base64
        const pdfContent = Buffer.from(textContent).toString('base64');
        return { pdfContent, formId: input.formId };
      }),
  }),

  // Feedback & Reporting
  feedback: router({
    submit: publicProcedure
      .input(z.object({
        feedbackType: z.enum(["outdated_info", "incorrect_data", "suggestion", "bug_report", "general"]),
        stepNumber: z.number().optional(),
        lguId: z.string().default("manila_city"),
        message: z.string().min(5),
      }))
      .mutation(async ({ ctx, input }) => {
        await createFeedback({
          userId: ctx.user?.id,
          feedbackType: input.feedbackType,
          stepNumber: input.stepNumber,
          lguId: input.lguId,
          message: input.message,
        });
        return { success: true };
      }),
  }),
});

export type AppRouter = typeof appRouter;
