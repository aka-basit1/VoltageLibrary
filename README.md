# Voltage Library

Library management website: React + TypeScript (client), Node + Express + TypeScript (server), JSON file storage.

## Run
Terminal 1:  cd server && npm install && npm run seed && npm run dev
Terminal 2:  cd client && npm install && npm run dev
Open http://localhost:5173

`npm run seed` creates data/books.json (10,000 copies). The server also seeds automatically on first start.

## Rules
Fee 100 PKR for 15 days (charged at issue). Late fine 5 PKR/day (charged at return). Max 3 books per reader, no two copies of one title.
Lost book: reader is charged the book price. Shelf layout: 2 sections x 10 shelves x 10 rows x 5 columns x 10 positions = 10,000 slots.
