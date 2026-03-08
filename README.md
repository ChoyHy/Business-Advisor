# SME Invoice & Expense Manager

A comprehensive tool for Malaysian SMEs to manage E-Invoices, track expenses via receipt scanning, and get AI-driven business insights.

## Features

- **AI E-Invoice Generation**: Scan handwritten notes or informal receipts to generate LHDN-compatible E-Invoices.
- **Expense Tracking**: Photograph business receipts to automatically log expenses.
- **Financial Reporting**: Visual charts for Sales by Category and Expense by Supplier.
- **AI Business Advisor**: Chat with an AI that analyzes your business performance.
- **Contact Management**: Manage Customers and Suppliers with their LHDN TIN details.
- **LHDN Sandbox**: Test E-Invoice submissions to a simulated LHDN sandbox environment.

---

## Local Development Setup

Follow these steps to run the application on your local machine.

### 1. Prerequisites

- **Node.js**: Version 18 or higher.
- **npm**: Usually comes with Node.js.
- **Gemini API Key**: Obtain a free API key from [Google AI Studio](https://aistudio.google.com/).

### 2. Installation

Clone the repository and install dependencies:

```bash
npm install
```

### 3. Environment Configuration

Create a `.env` file in the root directory and add your Gemini API key:

```env
GEMINI_API_KEY=your_actual_api_key_here
```

### 4. Running the Application

Start the development server:

```bash
npm run dev
```

The application will be available at `http://localhost:3000`.

### 5. Project Structure

- `server.ts`: Express backend with SQLite database logic.
- `src/App.tsx`: Main React frontend application.
- `src/types.ts`: TypeScript interfaces for transactions and contacts.
- `sme_business.db`: Local SQLite database file (created on first run).

---

## Deployment

For instructions on how to deploy this application to Google Cloud Run, please refer to [DEPLOYMENT.md](./DEPLOYMENT.md).
