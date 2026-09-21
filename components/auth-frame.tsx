import { LockKeyhole, UserRound, Activity, Trophy } from "lucide-react";
import { PacificBrand, PacificLogo } from "@/components/pacific-brand";
import { AppearanceControl } from "@/components/appearance-control";
export function AuthFrame({ children }: { children: React.ReactNode }) {
  return <main className="login-grid">
    <section className="login-brand" aria-label="Pacific Baseball Performance">
      <PacificBrand className="login-wordmark" />
      <div className="login-statement">
        <p className="login-kicker">The Work. The Results.</p>
        <blockquote className="login-quote"><span>People Lie,</span>{" "}<span>Numbers Don’t.</span></blockquote>
        <div className="login-accent" aria-hidden="true" />
        <p className="login-description">Your work, in one place. Follow your development from the first rep to the final out.</p>
        <div className="login-features">
          <div><UserRound size={19} aria-hidden="true"/><strong>Player Cards</strong><span>Measurements, progress & percentiles</span></div>
          <div><Activity size={19} aria-hidden="true"/><strong>Practice & Games</strong><span>Separate results. A complete picture.</span></div>
          <div><Trophy size={19} aria-hidden="true"/><strong>Team Rankings</strong><span>See how your recorded results compare</span></div>
        </div>
      </div>
      <div className="login-brand-footer"><PacificLogo variant="university" tone="dark" /><p>An independent project for Pacific Baseball.<br />Not an official university application.</p></div>
    </section>
    <section className="login-form-panel"><div className="login-form-content"><div className="login-form-tools"><AppearanceControl /></div><div className="login-access-label"><LockKeyhole size={15} aria-hidden="true" /><span>Team Access</span></div>{children}<p className="login-access-note">Your account determines the profiles and tools you can access.</p></div></section>
  </main>;
}
