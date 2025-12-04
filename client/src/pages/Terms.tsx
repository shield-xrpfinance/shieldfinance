import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Link } from "wouter";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function Terms() {
  return (
    <div className="min-h-screen bg-background p-4 sm:p-6 lg:p-8">
      <div className="max-w-4xl mx-auto">
        <div className="mb-6">
          <Link href="/">
            <Button variant="ghost" size="sm" className="gap-2">
              <ArrowLeft className="h-4 w-4" />
              Back to Home
            </Button>
          </Link>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-2xl sm:text-3xl">Terms of Service</CardTitle>
            <p className="text-muted-foreground">Last updated: December 2024</p>
          </CardHeader>
          <CardContent className="space-y-6">
            <section>
              <h2 className="text-xl font-semibold mb-3">1. Acceptance of Terms</h2>
              <p className="text-muted-foreground">
                By accessing and using Shield Finance ("the Service"), you accept and agree to be bound by these Terms of Service. If you do not agree to these terms, please do not use the Service.
              </p>
            </section>

            <Separator />

            <section>
              <h2 className="text-xl font-semibold mb-3">2. Description of Service</h2>
              <p className="text-muted-foreground">
                Shield Finance provides a testnet liquid staking protocol dashboard for XRP. The Service allows users to interact with testnet smart contracts, earn testnet points, and participate in testnet airdrop programs. All tokens and points are for testnet purposes only and have no monetary value.
              </p>
            </section>

            <Separator />

            <section>
              <h2 className="text-xl font-semibold mb-3">3. Testnet Disclaimer</h2>
              <p className="text-muted-foreground">
                This Service operates on blockchain testnets (Flare Coston2, XRPL Testnet). All assets, tokens, and transactions are simulated and have no real-world value. Users should not expect any financial returns from using this Service.
              </p>
            </section>

            <Separator />

            <section>
              <h2 className="text-xl font-semibold mb-3">4. User Responsibilities</h2>
              <ul className="list-disc list-inside text-muted-foreground space-y-2">
                <li>You are responsible for maintaining the security of your wallet credentials</li>
                <li>You agree not to abuse, exploit, or manipulate the Service</li>
                <li>You will not use the Service for any illegal purposes</li>
                <li>You understand that testnet tokens have no monetary value</li>
              </ul>
            </section>

            <Separator />

            <section>
              <h2 className="text-xl font-semibold mb-3">5. Social Media Integration</h2>
              <p className="text-muted-foreground">
                The Service may integrate with social media platforms including X (Twitter). By using these features, you authorize Shield Finance to post content on your behalf when you explicitly request it. You can revoke this access at any time through your social media account settings.
              </p>
            </section>

            <Separator />

            <section>
              <h2 className="text-xl font-semibold mb-3">6. Limitation of Liability</h2>
              <p className="text-muted-foreground">
                Shield Finance is provided "as is" without warranties of any kind. We are not liable for any losses, damages, or issues arising from the use of this testnet Service.
              </p>
            </section>

            <Separator />

            <section>
              <h2 className="text-xl font-semibold mb-3">7. Changes to Terms</h2>
              <p className="text-muted-foreground">
                We reserve the right to modify these terms at any time. Continued use of the Service after changes constitutes acceptance of the new terms.
              </p>
            </section>

            <Separator />

            <section>
              <h2 className="text-xl font-semibold mb-3">8. Contact</h2>
              <p className="text-muted-foreground">
                For questions about these Terms of Service, please contact us through our official channels.
              </p>
            </section>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
