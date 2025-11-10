# Supersaas V3

There are three versions of the repo

1. `main` - The main branch with the new Supersaas V3 code, this uses (NuxtHub)[https://hub.nuxt.com/] for deployment, a cloudflare D1 database and a cloudflare R2 bucket.
2. `postgres` - This branch is a 1 to 1 copy of the `main` branch but uses a postgres database and a custom S3 compatible blob storage.
3. `turso` - This branch is a 1 to 1 copy of the `main` branch but uses a turso database and a custom S3 compatible blob storage.

You can find a demo here - [https://v3.supersaas.dev](https://v3.supersaas.dev)

Docs - https://supersaas.dev/docs

## Dev

Run the app locally

```bash
pnpm run dev
```


## Production

Build the application for production:

```bash
pnpm build
```
