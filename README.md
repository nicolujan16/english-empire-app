# English Empire Institute - ERP & LMS Platform

Comprehensive educational, administrative, and financial management platform custom-developed for the **English Empire** language institute. This system centralizes the institute's daily operations, offering dedicated portals for administration, teaching staff, and students/guardians.

## 🚀 Key Features

The system is divided into three main ecosystems with Role-Based Access Control (RBAC):

### 🛡️ Admin Portal
- **Academic Management:** Course CRUD, capacity control, age ranges, dynamic scheduling, and categorization.
- **User Management:** Administration of primary students and dependents (Family Groups).
- **Core Financial Module:**
  - Automatic generation of monthly tuition fees.
  - Management of manual payments, special incomes, and expenses with support for **Split Payments**.
  - Advanced **Discount Tags** system (e.g., Scholarships, Siblings, Partnerships) with smart calculation for maximum benefit.
- **Staff Management:** Teacher onboarding and real-time course assignment/unassignment.

### 🧑‍🏫 Teacher Portal
- **Custom Dashboard:** Teachers only have access to their assigned courses.
- **Class Logging:** Creation of daily class instances (using idempotent IDs to prevent duplicates).
- **Digital Attendance:** Interactive attendance tracking with predefined states (Present, Late, Absent) and atomic saving.

### 🎓 User Portal (Students / Guardians)
- **Smart Enrollments:** Automated enrollment process that validates the student's age and applies the corresponding discounts.
- **Payment Gateway:** Full integration with **Mercado Pago** (Checkout Pro and Webhooks) for paying enrollments and monthly fees.
- **Transparent History:** Access to payment receipts, account statements, and real-time viewing of their dependents' attendance records.

## 💻 Tech Stack

**Frontend:**
- [Next.js](https://nextjs.org/) (App Router)
- [React 18](https://react.dev/)
- [Tailwind CSS](https://tailwindcss.com/)
- [Framer Motion](https://www.framer.com/motion/) (Fluid animations)
- [Shadcn UI](https://ui.shadcn.com/) & [Lucide React](https://lucide.dev/) (Components and iconography)

**Backend & Database:**
- [Firebase Firestore](https://firebase.google.com/docs/firestore) (Real-time NoSQL Database)
- [Firebase Authentication](https://firebase.google.com/docs/auth) (Session management and security)
- [Firebase Storage](https://firebase.google.com/docs/storage) (Image and receipt hosting)

**Payments & APIs:**
- [Mercado Pago SDK](https://www.mercadopago.com.ar/developers/)

## ⚙️ Architecture & Design

- **Single Source of Truth:** NoSQL database design optimized for fast reads and data consistency (e.g., immutable attendance histories).
- **Subdomains (Middleware):** Routing managed via Next.js Middleware to seamlessly route traffic between `admin.`, `teachers.`, and the main domain.
- **UI/UX:** Interfaces designed with a focus on mobile usability (Mobile-first approach for the teacher portal) and error prevention through tooltips and derived states.

## 🛠️ Local Installation & Setup

1. Clone the repository:
```bash
git clone https://github.com/your-username/english-empire.git
cd english-empire
```

2. Install dependencies:
```bash
npm install
```

3. Configure environment variables. Create a `.env.local` file in the root of the project based on the following schema:
```env
# Firebase Client (Public)
NEXT_PUBLIC_FIREBASE_API_KEY=your_api_key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your_auth_domain
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your_project_id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your_storage_bucket
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_messaging_sender_id
NEXT_PUBLIC_FIREBASE_APP_ID=your_app_id

# Mercado Pago
MP_ACCESS_TOKEN=your_production_or_test_access_token
NEXT_PUBLIC_APP_URL=http://localhost:3000
WEBHOOK_URL=your_ngrok_or_production_url
```

4. Start the development server:
```bash
npm run dev
```

The project will be available at `http://localhost:3000`.
