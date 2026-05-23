# Dependency Upgrade Strategy

# Dependency Upgrade Strategy

## ⚠️ CRITICAL LESSON LEARNED

**DO NOT** use `npm audit fix --force` without careful review. This command can:
- Downgrade packages to older versions with MORE vulnerabilities
- Break peer dependencies
- Introduce breaking changes

In our audit, `npm audit fix --force` downgraded Next.js from 16.2.4 to 9.3.3, introducing these CRITICAL vulnerabilities:
- Authorization bypass vulnerability (GHSA-...)
- Unexpected server crash in Next.js (multiple CVEs)

**Always review changes before committing.**

## Current Status (2026-05-23)

The application now has:
- **10 vulnerabilities** after restoring Next.js to 16.2.4 (down from 49)
- **3 high, 7 moderate** (down from 4 critical, 20 high, 19 moderate)
- All critical authorization/crash issues resolved

## Why Upgrades Are Challenging

The current dependency stack has several peer dependency conflicts:
- `next@16.2.4` is compatible with `react@19.2.4` but causes conflicts when updating other packages
- `@next-auth/prisma-adapter@^1.0.7` requires `next-auth@^4.24.14`
- Vulnerability fixes sometimes require version bumps that break peer dependencies

## Recommended Upgrade Path

### Phase 1: Safe Updates (No Breaking Changes)
- [ ] Update `protobufjs` to fix DoS vulnerability
- [ ] Update `ws` to fix uninitialized memory disclosure
- [ ] Update `brace-expansion` to fix DoS protection bypass

### Phase 2: Major Dependency Review
Requires testing and integration verification:
- [ ] Review Next.js 16.2.6+ for security fixes
- [ ] Consider Prisma version compatibility
- [ ] Verify all API tests pass after updates

### Phase 3: Full Stack Update
Only if Phase 2 is successful:
- [ ] Update entire dependency tree with `npm audit fix --force`
- [ ] Run full test suite
- [ ] E2E testing in staging
- [ ] Deploy to production

## How to Apply Manually

```bash
# Option 1: Gradual updates (safer)
npm install --save protobufjs@latest ws@latest

# Option 2: Use Dependabot (recommended)
# Enable Dependabot on GitHub and let it create PRs for updates

# Option 3: Package-by-package updates
npm audit
# For each vulnerability, update selectively
npm install --save-dev <package>@<version>
npm test
npm run test:e2e  # If they pass, commit
```

## Build-Time vs Runtime Vulnerabilities

### Build-Time (Lower Risk)
- loader-utils (webpack plugin)
- shell-quote (build script)
- These are only used during `npm run build`
- Don't affect the running application

### Runtime (Higher Risk)
- Next.js (routing, middleware, SSR)
- PostCSS (CSS processing)
- Prisma (database access)
- uuid (used by next-auth)
- These affect the application at runtime

## Testing After Updates

After any dependency update, run:

```bash
# Type checking
npm run build

# Unit tests
npm test -- --run

# E2E tests (requires dev server)
npm run test:e2e

# Full pre-merge check
npm run check:premerge

# Production build simulation
npm run check:prod
```

## Next Steps

1. **Immediate**: Ensure all code security fixes are deployed
2. **Short-term (2-4 weeks)**: Evaluate and apply safe dependency updates
3. **Medium-term (1-2 months)**: Plan major dependency upgrade with full testing
4. **Ongoing**: Enable Dependabot for automatic vulnerability alerts

## Resources

- [NPM Audit Documentation](https://docs.npmjs.com/cli/v8/commands/npm-audit)
- [Dependabot Guide](https://docs.github.com/en/code-security/dependabot)
- [Snyk Tool](https://snyk.io/) - Automated vulnerability scanning
- [OWASP Dependency Check](https://owasp.org/www-project-dependency-check/)
