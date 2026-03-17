#!/bin/sh
# Run Prisma migrations
npx prisma migrate deploy

# Start SpiderFoot in the background
python3 spiderfoot/sfapi.py -l 0.0.0.0:5001 &

# Start the main Node application
node src/index.js
