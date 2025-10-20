import z from 'zod';

export const Sha256Schema = z.string().regex(/^[a-f0-9]{64}$/i, 'Invalid SHA256 hash format');

export const Sha512Schema = z.string().regex(/^[a-f0-9]{128}$/i, 'Invalid SHA512 hash format');
