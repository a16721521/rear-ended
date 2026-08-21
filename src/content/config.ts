import { z, defineCollection } from 'astro:content';

const learnCollection = defineCollection({
  type: 'content',
  schema: z.object({
    title: z.string(),
    description: z.string(),
    publishDate: z.coerce.date(),
    updatedDate: z.coerce.date().optional(),
    category: z.enum([
      'car-accidents',
      'truck-accidents',
      'motorcycle-accidents',
      'slip-and-fall',
      'rideshare-accidents',
      'wrongful-death',
      'workers-compensation',
      'employment-law',
      'general',
    ]),
    tags: z.array(z.string()).default([]),
    draft: z.boolean().default(false),
    // AEO fields
    faq: z.array(z.object({
      question: z.string(),
      answer: z.string(),
    })).optional(),
    // E-E-A-T signals
    authorName: z.string().default('Law Dog Editorial Team'),
    authorTitle: z.string().default('Personal Injury & Employment Attorneys'),
    reviewedBy: z.string().optional(),
    // Schema hints
    legalCitation: z.string().optional(),
  }),
});

const attorneyCollection = defineCollection({
  type: 'content',
  schema: z.object({
    name: z.string(),
    title: z.string(),
    barNumber: z.string(),
    barState: z.string().default('California'),
    admittedYear: z.number(),
    practiceAreas: z.array(z.string()),
    education: z.array(z.object({
      degree: z.string(),
      institution: z.string(),
      year: z.number(),
    })),
    bio: z.string(),
    // Schema.org Person fields
    sameAs: z.array(z.string()).default([]),
    image: z.string().optional(),
    email: z.string().optional(),
    order: z.number().default(99),
  }),
});

const settlementsCollection = defineCollection({
  type: 'content',
  schema: z.object({
    title: z.string(),
    amount: z.string(),
    practiceArea: z.string(),
    caseType: z.string(),
    description: z.string(),
    year: z.number(),
    featured: z.boolean().default(false),
    // deliberately omit identifying client details
  }),
});

export const collections = {
  learn: learnCollection,
  attorneys: attorneyCollection,
  settlements: settlementsCollection,
};
