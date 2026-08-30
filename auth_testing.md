# Auth Testing Playbook

## MongoDB Verification
```
mongosh
use test_database
db.users.find({role: {$in: ["superadmin", "pic", "relawan"]}}, {email: 1, role: 1, password_hash: 1}).pretty()
db.users.getIndexes()
db.login_attempts.getIndexes()
```
Verify: seeded password hashes start with `$2b$`, `users.email` is unique, and `login_attempts.identifier` exists.

## API Testing
```
curl -c cookies.txt -X POST $API/api/auth/login -H "Content-Type: application/json" -d '{"email":"superadmin@baznas.id","password":"admin123"}'
cat cookies.txt
curl -b cookies.txt $API/api/auth/me
```
Login returns the user object and sets `access_token` + `refresh_token` cookies. `/me` returns the same user via cookies. Bearer token in Authorization header also works.

## Brute Force Lockout
Use a unique fake email and send 6 failed login attempts. Attempts 1-5 should return `401`; attempt 6 should return `429` with the 15-minute lockout message. The lock key is email-based so it remains stable behind ingress/proxy IP changes.
