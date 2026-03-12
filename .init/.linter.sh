#!/bin/bash
cd /home/kavia/workspace/code-generation/enterprise-commerce-platform-332160-332175/backend_expressjs
npm run lint
LINT_EXIT_CODE=$?
if [ $LINT_EXIT_CODE -ne 0 ]; then
  exit 1
fi

