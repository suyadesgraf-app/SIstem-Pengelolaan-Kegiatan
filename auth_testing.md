# Auth Testing Playbook

Step 1: MongoDB Verification
```
mongosh
use test_database
db.users.find({role: "superadmin"}).pretty()
```
Verify: bcrypt hash starts with `$2b$`, unique index on users.email.

Step 2: API Testing
```
curl -c cookies.txt -X POST $API/api/auth/login -H "Content-Type: application/json" -d '{"email":"superadmin@baznas.id","password":"admin123"}'
cat cookies.txt
curl -b cookies.txt $API/api/auth/me
```
Login returns the user object and sets access_token + refresh_token cookies. /me returns the same user via cookies. Bearer token in Authorization header also works.
