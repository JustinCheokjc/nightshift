import SimWallet from "@/components/SimWallet";
import PageHeader from "@/components/PageHeader";

export default function DemoWalletPage() {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Wallet"
        description="What idle hours would earn once paid jobs run."
        actions={<span className="badge warn">Simulated · no real money</span>}
      />
      <SimWallet userId="demo" devices={[]} summaries={[]} electricityRate={0.31} demo />
    </div>
  );
}
