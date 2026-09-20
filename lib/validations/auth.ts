import { z } from 'zod';
const email=z.string().trim().toLowerCase().email().max(254);
export const SignUpSchema=z.object({name:z.string().trim().min(2).max(100),email,password:z.string().min(8).max(128).regex(/[A-Z]/,'Password needs an uppercase letter').regex(/[^A-Za-z0-9]/,'Password needs a special character')});
export const SignInSchema=z.object({email,password:z.string().min(1).max(128)});
export const normalizedEmail=email;
export type SignUpInput=z.infer<typeof SignUpSchema>;
export type SignInInput=z.infer<typeof SignInSchema>;
