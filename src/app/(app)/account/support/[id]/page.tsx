import { PageHeader } from "@/components/layout/page-header";
import { TicketThread } from "@/components/support/ticket-thread";

export default async function SupportTicketPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <div className="flex flex-col">
      <PageHeader title="Ticket" backHref="/account/support" />
      <div className="p-4">
        <TicketThread ticketId={id} />
      </div>
    </div>
  );
}
