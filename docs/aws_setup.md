# AWS Amplify Sync Integration Setup — NHAI Biometrics

This guide details the AppSync schemas, DynamoDB mappings, and Amplify configurations needed to receive synced attendance logs from the offline-first queue database.

---

## 📐 GraphQL API Schema

Deploy this model schema in your central AWS Amplify configuration (`amplify/backend/api/schema.graphql`):

```graphql
# AttendanceRecord
# Buffers biometric verify actions logged at offline tolls and NHAI depots

type AttendanceRecord 
  @model 
  @auth(
    rules: [
      { allow: private, provider: userPools }
      { allow: groups, groups: ["Admins"], operations: [read, create, delete] }
    ]
  ) {
  id: ID!
  userId: String!            # Hashed SHA-256 employee fingerprint ID
  username: String!          # Display display name of the officer scanned
  timestamp: AWSTimestamp!   # Client-side capture time (UNIX Epoch MS)
  deviceId: String           # Unique physical identifier of the scanner tablet
  livenessScore: Float       # Decimals representing verification liveness
  confidence: Float          # Decimals representing matching similarity
}
```

---

## ⚡ Setup Workflow

To provision your cloud resources using the Amplify CLI:

### 1. Initialize AWS Amplify
Run in the root folder of Datalake 3.0:
```bash
amplify init
```
*   Select your AWS active region.
*   Link to your IAM administrative access profiles.

### 2. Provision standard GraphQL API
Deploy the API cluster using:
```bash
amplify add api
```
*   Select category: `GraphQL`.
*   API Name: `NHAI_Biometrics_Lake`.
*   Authorization Provider: `Amazon Cognito User Pools` (paired with standard NHAI ActiveDirectory AD).
*   Select options: `Yes, I want to deploy custom models`. Paste the API model schema described above.

### 3. Deploy API changes to Cloud
Sync local schema files to AWS AppSync and automatically spin up target DynamoDB datastore engines:
```bash
amplify push -y
```

---

## 🔧 Resolving Sync Failures

1.  **Datalake 3.0 Sync Conflicts**: The SDK operates under standard **Optimistic Concurrency / Automerge** modes. In the event two tablets push similar sync keys, AppSync evaluates the `_version` attributes and automerges chronologically.
2.  **Cognito JWT Timeout**: If pushing triggers authorization exceptions, the SDK buffers updates in SQLite. It will retry automatically once the Datalake core app re-authenticates the current user session and refreshes Cognito auth tokens.
