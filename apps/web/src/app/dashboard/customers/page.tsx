import type { Metadata } from "next";
import { CustomerTable } from "@/components/dashboard/customer-table";
import { listCustomers } from "@/lib/services/vouchers";

export const metadata: Metadata = { title: "Customers" };

export default async function CustomersPage() {
  return <CustomerTable customers={await listCustomers()} />;
}
