# Pull Request to Deploy to Prod

## PRs Incorporated

<!-- List the PRs that are included in this deployment. You can either mention their numbers or titles. -->

Example:

- #42
- #43

## Summary of the Changes Being Deployed

<!-- Provide a brief summary of the changes, focusing on what is being deployed. Highlight any key features or fixes. -->

- Generates certificate upon checker program completion
- Triggers admins on Telegram that checker has completed program

## Other Deployment Activities Checklist

<!-- Include any necessary activities that need to be performed before or after the deployment. This might involve database migrations, feature flags, or manual steps. -->

- [ ] Patch checkers db

## Contingency/Rollback Plan

<!-- Outline steps to rollback in case of failure. -->

- Step 1: Revert to the previous stable commit on `prod` branch: `git revert <commit_hash>`
