# Security Policy & Best Practices

## Overview

This document outlines security practices and guidelines for the UNS Correlativas Web application. The application processes educational plans through AI-powered PDF parsing and manages user authentication and authorization.

## Security Updates

### Dependency Vulnerabilities (2026-05-23)

Several security updates have been applied:

- **Next.js**: Updated to address multiple vulnerabilities including DoS, cache poisoning, and XSS
- **Prisma**: Updated Effect dependency to fix AsyncLocalStorage context issues
- **PostCSS**: Updated to fix XSS via CSS output
- **UUID**: Updated for buffer bounds check
- **Protobufjs**: Updated to prevent DoS via recursive JSON
- **WebSocket (ws)**: Updated to prevent uninitialized memory disclosure

Run `npm audit` to verify all vulnerabilities are addressed.

## Authentication & Authorization

### Role Override Security

Development role override is now **disabled by default** and requires explicit configuration:

```bash
# Only enable in development
NODE_ENV=development AUTH_ALLOW_DEV_ROLE_OVERRIDE=true
```

**Never enable in production.** Any authenticated user with role override enabled can become an admin.

### Development Login

The development login feature allows testing authentication without external OAuth providers.

**Security Controls**:
- Only available when `AUTH_ENABLE_DEV_LOGIN=true`
- Email allowlist prevents unauthorized access (if configured)
- Automatically disabled in production
- Never stores credentials in database

**Configuration**:
```bash
# Development only
AUTH_ENABLE_DEV_LOGIN=true
AUTH_ALLOW_DEV_ROLE_OVERRIDE=false
AUTH_DEV_LOGIN_EMAIL_ALLOWLIST="dev@example.com,test@example.com"
```

**⚠️ Important**: If dev-login is enabled, the email allowlist MUST be configured. If empty, dev login is denied by default.

## Environment Variables

### Required Variables

```bash
# Database
DATABASE_URL="postgresql://user:pass@host/db"
DIRECT_URL="postgresql://user:pass@host/db"  # For migrations

# Authentication
NEXTAUTH_SECRET="<long-random-string>"
NEXTAUTH_URL="https://production-domain.com"

# AI Service (if using Gemini)
GEMINI_API_KEY="<your-gemini-api-key>"

# Parser API
PARSER_API_URL="https://parser-api-url"  # Optional, for remote parsing
ALLOWED_ORIGIN="https://production-domain.com"
```

### Environment Variable Validation

All sensitive environment variables are validated on startup:
- `DATABASE_URL` must be a valid PostgreSQL connection string
- `NEXTAUTH_SECRET` is required and validated for minimum length
- Missing required vars will cause startup failure (intentional)

### Secrets Management

**Do NOT:**
- Commit `.env.local` or `.env.production.local`
- Store secrets in code comments
- Use weak or test secrets in production
- Log environment variables

**Do:**
- Use a secrets manager (GitHub Secrets, AWS Secrets Manager, Vercel Secrets)
- Rotate secrets regularly
- Use unique secrets per environment
- Validate secret strength on deployment

## File Upload Security

### PDF Upload Validation

File uploads are validated on multiple levels:

1. **Filename check**: Must end with `.pdf`
2. **Magic bytes check**: File must start with PDF signature (`%PDF`)
3. **Size limit**: Maximum 20 MB
4. **Content validation**: Gemini API validates PDF structure

**Security controls**:
- Uploaded files are stored temporarily and deleted after processing
- Files are NOT stored in the web root (prevents direct access)
- File size is enforced before processing
- MIME type is validated via magic bytes

### Upload Endpoints

- `POST /api/admin/planes/parsear` - Process PDF with Gemini
- `POST /parser_api/parse` - Direct local parsing
- `POST /parser_api/parse-gemini` - Remote Gemini parsing

All endpoints require authentication and authorization.

## API Security

### Authentication

All sensitive API endpoints require valid authentication via `auth()` middleware:

```typescript
const session = await auth();
if (!session?.user?.id) {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}
```

### Authorization

Role-based access control (RBAC) for admin endpoints:

```typescript
if (session.user.role !== Role.ADMIN && session.user.role !== Role.MODERATOR) {
  return NextResponse.json({ error: "Forbidden" }, { status: 403 });
}
```

Roles:
- `USER`: Regular user, can view plans and track progress
- `MODERATOR`: Can review and approve pending plans
- `ADMIN`: Full access, can configure system and manage all plans

### Input Validation

All API endpoints validate input using Zod schemas:

```typescript
const updateSchema = z.object({
  materiaNombre: z.string().min(1).max(200),
  materiaId: z.string().nullish(),
  dia: z.number().int().min(1).max(5),
});

const parsed = updateSchema.safeParse(rawBody);
if (!parsed.success) {
  return NextResponse.json({ error: "Invalid input" }, { status: 400 });
}
```

### Error Handling

**Error messages are sanitized to prevent information disclosure:**
- Generic error messages returned to clients
- Detailed errors logged only in development
- No stack traces in API responses
- No configuration details revealed

## Security Headers

The following HTTP security headers are configured:

```
X-Content-Type-Options: nosniff        # Prevent MIME sniffing
X-Frame-Options: DENY                  # Prevent clickjacking
X-XSS-Protection: 1; mode=block        # Enable XSS filter
Referrer-Policy: strict-origin-when-cross-origin
Permissions-Policy: camera=(), microphone=(), geolocation=()
Cache-Control: no-store (for /api/*)   # Prevent caching of API responses
```

## CORS Security

### Parser API CORS

CORS is configured for the remote parser API:

```python
# parser_api/main.py
ALLOWED_ORIGINS = os.environ.get("ALLOWED_ORIGIN", "").strip().split(",")
```

**⚠️ Important**: 
- `ALLOWED_ORIGIN` must be explicitly configured
- Supports comma-separated list of origins
- No hardcoded default origins
- CORS middleware is not added if no origins are configured

## Database Security

### Connection

- Always use secure connections (SSL/TLS) in production
- Use pooled connections (pgBouncer) for runtime
- Use direct connections for migrations only
- Enforce `requireSSL` in connection strings

### Query Safety

- All queries use Prisma ORM (prevents SQL injection)
- No raw SQL queries in application code
- Input is always validated before database operations
- Sensitive data queries are restricted by user permissions

### Sensitive Data

- Passwords are hashed and salted (via NextAuth)
- API keys are never logged
- Personal information follows GDPR principles
- Audit logs track all administrative actions

## Logging Security

### Log Guidelines

**Do NOT log**:
- API keys or secrets
- User credentials or passwords
- Full request/response bodies
- Personal information
- Stack traces in production

**Do log**:
- API request path (not full URL with query strings)
- HTTP method and status code
- Error type/category (not details)
- User actions for audit trail
- Timestamps and user IDs for audit

### Log Example (Good)

```typescript
console.error("[api/materias] Error loading plan data", {
  errorType: error.constructor.name,
  // Only in development
  ...(process.env.NODE_ENV === "development" && { details: error.message })
});
```

### Log Example (Bad - Don't do this)

```typescript
// ❌ Exposes full error and request details
console.error("[api/materias]", req.url, error);

// ❌ Logs API keys
console.log("Using API key:", process.env.GEMINI_API_KEY);

// ❌ Logs sensitive data
console.error("User failed auth", { email, password, ip });
```

## Rate Limiting

Currently **NOT implemented**. Before deploying to production with high traffic:

1. Add rate limiting middleware to expensive endpoints:
   - `POST /api/admin/planes/parsear` (Gemini API usage)
   - `POST /api/progreso/sync` (Database writes)
   - `POST /api/planificador/exportar-gcal` (Google API quota)

2. Suggested implementation:
   ```typescript
   import { Ratelimit } from "@upstash/ratelimit";
   
   const ratelimit = new Ratelimit({
     redis: Redis.fromEnv(),
     limiter: Ratelimit.slidingWindow(10, "1 h"),
   });
   
   const { success } = await ratelimit.limit(`gemini-${userId}`);
   if (!success) return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 });
   ```

## Security Testing

### Dependency Scanning

Run regularly:
```bash
npm audit
python -m pip check
```

Fix vulnerabilities:
```bash
npm audit fix
npm audit fix --force  # With breaking changes
```

### Static Analysis

Consider adding to CI/CD:
- ESLint with security plugins
- CodeQL analysis
- Snyk security scanning
- OWASP dependency checking

### Dynamic Testing

- Run E2E tests with `npm run test:e2e`
- Test with invalid inputs
- Verify auth/authz restrictions
- Check error messages don't leak info

## Incident Response

If you discover a security vulnerability:

1. **Do NOT** create a public GitHub issue
2. **Report privately** to project maintainers
3. **Include**:
   - Description of vulnerability
   - Steps to reproduce
   - Impact assessment
   - Suggested fix (if available)

## Compliance & Regulations

### GDPR (Personal Data)

- User data is minimal: email, name, roles
- No data is shared with third parties (except OAuth/Gemini with user consent)
- Users can request data deletion
- Session data is JWT-based and stateless

### Data Retention

- Session cookies expire after 24 hours
- User activity logs are kept for audit purposes
- Plan data is retained indefinitely
- Deleted plans are soft-deleted (kept with deleted flag)

## Regular Security Practices

1. **Monthly**: Review and update dependencies
2. **Monthly**: Check security advisories for packages in use
3. **Quarterly**: Review access logs and audit trails
4. **Quarterly**: Update security documentation
5. **Annually**: Perform full security audit
6. **Per-release**: Run security tests in CI/CD

## Resources

- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [Next.js Security Best Practices](https://nextjs.org/docs/guides/security)
- [Node.js Security](https://nodejs.org/en/docs/guides/security/)
- [Prisma Security](https://www.prisma.io/docs/concepts/components/prisma-client/raw-database-access#sql-injection)

## Questions?

For security questions or concerns, contact the maintainers privately.
