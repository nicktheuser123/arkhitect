# Order Validation

Validates GP_Order financial calculations against Bubble API data. Uses Jest for testing and fetches order, add-on, and event data from the Bubble API.

## Prerequisites

- **Node.js** (v14 or later recommended)

## Setup

1. **Initialize project** (if no `package.json` exists)

   ```bash
   npm init -y
   ```

2. **Install dependencies**

   ```bash
   npm install axios dotenv jest
   ```

3. **Environment variables**

   Copy the example env file and add your Bubble API credentials:

   ```bash
   cp .env.example .env
   ```

   Edit `.env` and set:

   ```
   BUBBLE_API_BASE=https://your-bubble-app.bubbleapps.io/api/1.1/obj
   BUBBLE_API_TOKEN=your-bubble-api-token-here
   ```

4. **Run tests**

   ```bash
   npx jest
   ```

   To run tests in watch mode:

   ```bash
   npx jest --watch
   ```

## What gets validated

- Ticket count
- Gross amount
- Discount amount (flat and percentage)
- Processing fee revenue and deduction
- Total order value
- Service fee
- Donation amount
- Custom fees

## Configuration

The test order ID is set in `order.test.js` (in the `beforeAll` hook). Change `ORDER_ID` to validate a different order.
