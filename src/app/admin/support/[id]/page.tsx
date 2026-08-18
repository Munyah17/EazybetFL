import { TicketThread } from "@/components/support/ticket-thread";

export default async function AdminSupportTicketPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <div className="mx-auto max-w-2xl">
      <TicketThread ticketId={id} isAdmin />
    </div>
  );
}
