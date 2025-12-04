# Bid&Buy

A web-based auction platform built with FastAPI and React.

## Overview

This application allows users to create auctions (lots), place bids, and simulate payments. It includes an automatic background system to handle auction expiration and payment deadlines, as well as an administration panel for user management.

## Key Functionality

* **User System:** Authentication via Auth0. Profile management (username, phone, bio).
* **Lots:** Create, edit, and delete lots with multiple images.
* **Bidding:** Real-time price updates. Logic prevents bidding on own lots and ensures minimum step increments.
* **Auction Lifecycle:**
    * Automatic closure of lots without bids (with a 24-hour restore window).
    * Payment deadlines for winners.
    * Automatic transfer of victory to the next highest bidder if the winner fails to pay.
* **Notifications:** System alerts for deleted lots or status changes.
* **Admin Panel:** User blocking (ban), forced lot deletion - both with reasoning.

## Tech Stack

* **Backend:** Python, FastAPI, SQLAlchemy (Async), Uvicorn.
* **Frontend:** React, Vite, Axios.
* **Database:** PostgreSQL.
* **Auth:** Auth0.

## Prerequisites

* Python 3.10+
* Node.js 18+
* PostgreSQL
* Auth0 Account (Tenant)

Create a PostgreSQL database (e.g., `bbm_database`). You can execute the provided SQL script to set up the necessary tables:

```bash
psql -U postgres -d bbm_database -f postgres_tables.sql
