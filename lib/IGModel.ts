import { z } from "zod";

export const IGUserSchema = z.object({
    id: z.number().gte(0),
    username: z.string(),
    profile_picture_url: z.string().optional(),
    access_token: z.string().url(),
    created_at: z.date(),
    updated_at: z.date().optional(),
    timestamp: z.number(),
});

export const IGMediaSchema = z.object({
    post_id: z.number().gte(0),
    index: z.number().gte(0),
    media_type: z.enum(["image", "video"]),
    media_url: z.string().url(),
    thumbnail_url: z.string().url().optional(),
    timestamp: z.number(),
});

export const IGPostSchema = z.object({
    id: z.number().gte(0),
    user_id: z.number().gte(0),
    caption: z.string().optional(),
    postedAt: z.date(),
    media: z.array(IGMediaSchema).nonempty(),
    timestamp: z.number(),
});

// TypeScript types can be inferred from the schemas
export type IGUser = z.infer<typeof IGUserSchema>;
export type IGPost = z.infer<typeof IGPostSchema>;
export type IGMedia = z.infer<typeof IGMediaSchema>;