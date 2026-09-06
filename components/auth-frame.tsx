import { LockKeyhole } from "lucide-react";
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
        <p className="login-description">A shared view of the work behind the game.<br />Player profiles, testing and team performance.</p>
      </div>
      <div className="login-brand-footer"><PacificLogo variant="university" tone="dark" /><p>An independent project for Pacific Baseball.<br />Not an official university application.</p></div>
    </section>
    <section className="login-form-panel"><div className="login-form-content"><div className="login-form-tools"><AppearanceControl /></div><div className="login-access-label"><LockKeyhole size={15} aria-hidden="true" /><span>Team Access</span></div>{children}<p className="login-access-note">Your account determines the profiles and tools you can access.</p></div></section>
  </main>;
}
