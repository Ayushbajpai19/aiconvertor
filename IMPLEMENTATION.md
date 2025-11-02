# Statement Converter - Full Stack Implementation

## Overview
A complete SaaS application for converting PDF bank statements to Excel format with authentication, subscription management, and payment processing.

## Features Implemented

### 1. Authentication System
- **Supabase Auth Integration**: Email/password authentication with session management
- **Pages**:
  - Login (`/login`)
  - Register (`/register`)
  - Forgot Password (`/forgot-password`)
  - Reset Password (`/reset-password`)
- **Security**: Protected routes, JWT token validation, automatic session refresh

### 2. Subscription Tiers
Four subscription plans with automatic enforcement:

| Plan | Price | PDF Limit | Features |
|------|-------|-----------|----------|
| **Free** | $0/month | 1 PDF total | Basic extraction, CSV export |
| **Basic** | $9.99/month | 50 PDFs/month | History, AI insights, Email support |
| **Professional** | $29.99/month | 200 PDFs/month | Goal Planner, Priority processing, Advanced analytics |
| **Enterprise** | $99.99/month | Unlimited | API access, Dedicated support, SLA |

### 3. Database Schema
Comprehensive database structure with Row Level Security:

- **profiles**: User profile information
- **subscription_plans**: Available subscription tiers
- **subscriptions**: User subscription records
- **user_usage**: Monthly conversion tracking
- **conversions_history**: Record of all conversions
- **payments**: Payment transaction log

### 4. Pages & Navigation

#### Public Pages
- **Home** (`/`): File upload and conversion interface
- **Pricing** (`/pricing`): Subscription plan comparison
- **Terms & Conditions** (`/terms`): Legal terms
- **Refund Policy** (`/refund-policy`): Cancellation and refund information
- **Contact** (`/contact`): Contact form

#### Protected Pages (Require Authentication)
- **History** (`/history`): View past conversions
- **Profile** (`/profile`): Account settings
- **Billing** (`/billing`): Subscription and payment management
- **Checkout** (`/checkout/:planId`): Subscription purchase flow

### 5. Navigation Components
- **Navbar**: Responsive navigation with user menu, plan status, and conversion counter
- **Footer**: Quick links, legal pages, and contact information
- **Mobile Menu**: Hamburger menu for mobile devices

### 6. Subscription & Paywall System
- **Conversion Limits**: Automatic enforcement based on subscription tier
- **Paywall Modal**: Displayed when users reach their limit
- **Usage Tracking**: Real-time conversion count updates
- **Upgrade Prompts**: Context-aware upgrade suggestions

### 7. Dodo Payments Integration
- **Checkout Flow**: Redirect to Dodo Payments for subscription purchase
- **Webhook Handler**: Supabase Edge Function (`dodo-webhook`) for payment events
- **Supported Events**:
  - `payment.succeeded`: Activates subscription
  - `payment.failed`: Marks subscription as past_due
  - `subscription.cancelled`: Updates subscription status

### 8. Conversion Features
- **File Upload**: Drag-and-drop PDF upload
- **Password Protection**: Support for encrypted PDFs
- **AI Processing**: Transaction extraction using Gemini AI
- **Export Options**: CSV download and clipboard copy
- **History Storage**: All conversions saved to database
- **AI Insights**: Financial analysis and recommendations
- **Goal Planner**: Savings goal calculator

### 9. User Dashboard
- **Current Plan Display**: Shows active subscription and renewal date
- **Usage Statistics**: Visual progress bar and remaining conversions
- **Conversion History**: Paginated table with search and filters
- **Payment History**: List of all transactions

### 10. Security Features
- **Row Level Security**: Database policies ensure users only access their data
- **Authentication Guards**: Protected routes redirect to login
- **Session Management**: Automatic token refresh and logout
- **Input Validation**: Form validation on all user inputs
- **Secure Webhooks**: Signature verification for payment events

## Technical Stack

### Frontend
- **React 19.1.1**: Modern React with hooks
- **TypeScript**: Type-safe development
- **React Router Dom 7.9.5**: Client-side routing
- **Tailwind CSS**: Utility-first styling
- **Vite**: Fast build tool and dev server

### Backend
- **Supabase**: Backend-as-a-Service
  - PostgreSQL database
  - Authentication
  - Row Level Security
  - Edge Functions
- **Gemini AI**: Transaction extraction and insights
- **PDF.js**: PDF parsing and rendering

### Payments
- **Dodo Payments**: Subscription and payment processing
- **Webhook Integration**: Real-time payment event handling

## Environment Variables

```env
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

## Getting Started

### 1. Register an Account
Visit `/register` to create a free account with 1 PDF conversion.

### 2. Upload a Statement
Drag and drop a PDF bank statement on the home page.

### 3. Convert
Click "Convert All" to extract transactions.

### 4. Upgrade (Optional)
Visit `/pricing` to upgrade for more conversions and features.

## Subscription Management

### Viewing Current Plan
- Check navbar dropdown for quick plan info
- Visit `/billing` for detailed subscription information

### Upgrading
1. Navigate to `/pricing`
2. Select desired plan
3. Complete checkout via Dodo Payments
4. Subscription activates immediately

### Usage Tracking
- Conversion count updates after each successful conversion
- Usage resets monthly for Basic and Professional plans
- Free plan has lifetime limit of 1 conversion

### Cancellation
- Visit `/billing` page
- Click "Change Plan"
- Follow cancellation flow
- Access retained until period end

## Database Functions

### `get_active_subscription(user_id)`
Returns active subscription details for a user.

### `get_remaining_conversions(user_id)`
Calculates remaining conversions based on plan and usage.

## API Endpoints

### Edge Functions
- **`/functions/v1/dodo-webhook`**: Handles Dodo Payments webhooks

## Design System

### Colors
- **Primary**: Blue (#2563eb)
- **Secondary**: Gray (#6b7280)
- **Success**: Green (#10b981)
- **Error**: Red (#ef4444)
- **Background**: Light gray gradient

### Typography
- **Font**: Inter (Google Fonts)
- **Headings**: Bold, 1.5-4rem
- **Body**: Regular, 0.875-1rem

### Components
- **Cards**: White background, rounded corners, subtle shadow
- **Buttons**: Blue primary, gray secondary
- **Forms**: Rounded inputs, focus rings
- **Modals**: Centered overlay with backdrop

## Future Enhancements

### Planned Features
- Email notifications for usage alerts
- Bulk file upload (multiple PDFs at once)
- Advanced filtering in history page
- Export formats (Excel, JSON)
- API access for Enterprise users
- Team accounts and collaboration
- Custom branding options

### Optimization
- Code splitting for faster initial load
- Image optimization
- Progressive Web App (PWA)
- Offline support

## Support

For questions or issues:
- Email: support@example.com
- Visit: `/contact`

## License

© 2025 Acme Corporation. All Rights Reserved.
