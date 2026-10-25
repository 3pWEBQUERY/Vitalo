import Link from "next/link";
import { Icon } from "@/components/Icon";
import { requireAdmin } from "@/lib/admin";
import { ChallengeForm } from "../ChallengeForm";

export default async function NewChallengePage() {
  await requireAdmin("moderation");
  return (
    <main className="page narrow">
      <Link href="/admin/community/challenges" className="back"><Icon name="chevronRight" size={14} className="flip" />Challenges</Link>
      <div className="header">
        <div>
          <h1>Challenge anlegen</h1>
          <p>Erscheint für alle in der Community und lässt sich jederzeit anpassen.</p>
        </div>
      </div>
      <ChallengeForm />
    </main>
  );
}
