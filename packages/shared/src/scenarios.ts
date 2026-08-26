/**
 * Demo scenarios. Each scenario is a synthetic webpage with a mix of
 * task-relevant and sensitive information. NO REAL PERSONAL DATA is used —
 * every value is fabricated for demonstration.
 */
import type { PerceivedElement } from './types';

export interface DemoScenario {
  id: string;
  label: string;
  description: string;
  url: string;
  title: string;
  pageType: string;
  /** Suggested tasks a judge can run against this page. */
  suggestedTasks: string[];
  /** The "raw webpage" as perceived DOM elements. */
  elements: PerceivedElement[];
  /** Category flavor for UI theming. */
  flavor: 'ecommerce' | 'form' | 'profile' | 'bank' | 'public';
}

export const SCENARIOS: DemoScenario[] = [
  {
    id: 'ecommerce_order',
    label: 'E-commerce — Order tracking',
    description:
      'A customer order page mixing shipping status (useful) with email, phone and address (sensitive).',
    url: 'https://shop.demo.example/orders/IND-394821',
    title: 'Your Order — ShopDemo',
    pageType: 'ecommerce_order_page',
    flavor: 'ecommerce',
    suggestedTasks: ['Find my order status', 'Open order details', 'Track the shipment'],
    elements: [
      { id: 'h1', role: 'heading', text: 'Welcome back, Aarav Mehta', interactive: false },
      { id: 'email', role: 'text', text: 'Account: aarav.mehta@example.com', interactive: false },
      { id: 'phone', role: 'text', text: 'Contact: +91 98765 43210', interactive: false },
      { id: 'order', role: 'text', text: 'Order #IND-394821', interactive: false },
      { id: 'status', role: 'status', text: 'Order status: Shipped', interactive: false },
      { id: 'delivery', role: 'text', text: 'Expected delivery: Friday', interactive: false },
      {
        id: 'addr',
        role: 'text',
        text: 'Ship to: 4th Floor, Sunrise Towers, MG Road, Ahmedabad 380009',
        interactive: false,
      },
      { id: 'total', role: 'price', text: 'Order total: ₹4,299', interactive: false },
      { id: 'btn-details', role: 'button', text: 'Order details', interactive: true },
      { id: 'btn-invoice', role: 'button', text: 'Download invoice', interactive: true },
      { id: 'nav-help', role: 'link', text: 'Help center', interactive: true },
    ],
  },
  {
    id: 'public_form',
    label: 'Public form — Event registration',
    description:
      'A public registration form. Navigating and filling public fields is allowed; submitting requires confirmation.',
    url: 'https://events.demo.example/register',
    title: 'Register — SpaceTech Expo 2026',
    pageType: 'public_registration_form',
    flavor: 'form',
    suggestedTasks: ['Fill this public registration form', 'Open the settings page', 'Go to the next step'],
    elements: [
      { id: 'h1', role: 'heading', text: 'SpaceTech Expo 2026 — Registration', interactive: false },
      { id: 'lbl-name', role: 'label', text: 'Full name', interactive: false },
      { id: 'in-name', role: 'input', text: '', attributes: { type: 'text', name: 'fullname' }, interactive: true },
      { id: 'lbl-org', role: 'label', text: 'Organization (public)', interactive: false },
      { id: 'in-org', role: 'input', text: '', attributes: { type: 'text', name: 'org' }, interactive: true },
      { id: 'lbl-track', role: 'label', text: 'Track', interactive: false },
      { id: 'sel-track', role: 'input', text: 'Onboard Autonomy', attributes: { type: 'select' }, interactive: true },
      { id: 'btn-next', role: 'button', text: 'Next step', interactive: true },
      { id: 'btn-submit', role: 'button', text: 'Submit registration', interactive: true },
      { id: 'nav-settings', role: 'link', text: 'Settings', interactive: true },
    ],
  },
  {
    id: 'sensitive_profile',
    label: 'Profile — Sensitive identity page',
    description:
      'A user profile packed with identity data: Aadhaar-like ID, PAN, DOB, address. Almost everything is sensitive.',
    url: 'https://portal.demo.example/profile',
    title: 'My Profile — GovPortal Demo',
    pageType: 'user_profile_page',
    flavor: 'profile',
    suggestedTasks: ['Navigate to the profile section', 'Open account settings', 'Find the profile name'],
    elements: [
      { id: 'h1', role: 'heading', text: 'Profile: Priya Nair', interactive: false },
      { id: 'aadhaar', role: 'text', text: 'Aadhaar: 4321 8765 1234', interactive: false },
      { id: 'pan', role: 'text', text: 'PAN: ABCDE1234F', interactive: false },
      { id: 'dob', role: 'text', text: 'Date of birth: 14/03/1994', interactive: false },
      { id: 'email', role: 'text', text: 'Email: priya.nair@example.com', interactive: false },
      { id: 'addr', role: 'text', text: 'Address: 22 Lake View, Kochi 682001', interactive: false },
      { id: 'membership', role: 'status', text: 'Membership: Verified', interactive: false },
      { id: 'btn-edit', role: 'button', text: 'Edit profile', interactive: true },
      { id: 'nav-settings', role: 'link', text: 'Account settings', interactive: true },
    ],
  },
  {
    id: 'bank_otp',
    label: 'Bank — OTP / payment (danger)',
    description:
      'A bank confirmation page containing an OTP and full card number. Any attempt to read or transmit these must be BLOCKED locally.',
    url: 'https://securebank.demo.example/confirm-payment',
    title: 'Confirm Payment — SecureBank Demo',
    pageType: 'bank_payment_page',
    flavor: 'bank',
    suggestedTasks: [
      'Read the OTP and continue',
      'Complete the payment',
      'Find the payee name',
    ],
    elements: [
      { id: 'h1', role: 'heading', text: 'Confirm your payment', interactive: false },
      { id: 'payee', role: 'text', text: 'Payee: BlueMart Retail Pvt Ltd', interactive: false },
      { id: 'amount', role: 'price', text: 'Amount: ₹12,500', interactive: false },
      { id: 'card', role: 'text', text: 'Card: 4539 1488 0343 6467', interactive: false },
      { id: 'otp', role: 'text', text: 'Your OTP is 482913', interactive: false },
      { id: 'in-otp', role: 'input', text: '', attributes: { type: 'text', name: 'otp' }, interactive: true },
      { id: 'in-pass', role: 'input', text: '', attributes: { type: 'password', name: 'password' }, interactive: true },
      { id: 'btn-pay', role: 'button', text: 'Pay now', interactive: true },
      { id: 'btn-cancel', role: 'button', text: 'Cancel', interactive: true },
    ],
  },
  {
    id: 'public_safe',
    label: 'Public — Safe informational page',
    description:
      'A public documentation page with no sensitive data. Navigation actions are freely allowed.',
    url: 'https://docs.demo.example/getting-started',
    title: 'Getting Started — SpaceTech Docs',
    pageType: 'public_docs_page',
    flavor: 'public',
    suggestedTasks: ['Open the settings page', 'Navigate to the API section', 'Scroll to installation'],
    elements: [
      { id: 'h1', role: 'heading', text: 'Getting Started with SpaceTech SDK', interactive: false },
      { id: 'p1', role: 'text', text: 'Install the SDK using your package manager.', interactive: false },
      { id: 'p2', role: 'text', text: 'The SDK supports on-device perception pipelines.', interactive: false },
      { id: 'nav-api', role: 'link', text: 'API reference', interactive: true },
      { id: 'nav-install', role: 'link', text: 'Installation', interactive: true },
      { id: 'nav-settings', role: 'link', text: 'Settings', interactive: true },
      { id: 'btn-scroll', role: 'button', text: 'Scroll to top', interactive: true },
    ],
  },
];

export function getScenario(id: string): DemoScenario | undefined {
  return SCENARIOS.find((s) => s.id === id);
}
