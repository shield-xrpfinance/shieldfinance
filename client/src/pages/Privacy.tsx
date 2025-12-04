import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Link } from "wouter";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function Privacy() {
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
            <CardTitle className="text-2xl sm:text-3xl">Privacy Policy</CardTitle>
            <p className="text-muted-foreground">Last updated: December 2024</p>
          </CardHeader>
          <CardContent className="space-y-6">
            <section>
              <h2 className="text-xl font-semibold mb-3">1. Information We Collect</h2>
              <p className="text-muted-foreground mb-3">
                Shield Finance collects minimal information necessary to provide our testnet services:
              </p>
              <ul className="list-disc list-inside text-muted-foreground space-y-2">
                <li><strong>Wallet Addresses:</strong> Public blockchain addresses you connect to the Service</li>
                <li><strong>Transaction Data:</strong> Testnet transaction information related to your activities</li>
                <li><strong>Points & Activity:</strong> Your testnet points, tier status, and referral information</li>
                <li><strong>Social Media:</strong> If you authorize X (Twitter) integration, your public profile information</li>
              </ul>
            </section>

            <Separator />

            <section>
              <h2 className="text-xl font-semibold mb-3">2. How We Use Your Information</h2>
              <ul className="list-disc list-inside text-muted-foreground space-y-2">
                <li>To provide and maintain the testnet staking Service</li>
                <li>To track your testnet points and tier progression</li>
                <li>To enable referral program functionality</li>
                <li>To post to X (Twitter) on your behalf when you explicitly request it</li>
                <li>To improve and optimize the Service</li>
              </ul>
            </section>

            <Separator />

            <section>
              <h2 className="text-xl font-semibold mb-3">3. Social Media Integration</h2>
              <p className="text-muted-foreground">
                When you connect your X (Twitter) account, we may access your public profile information. We will only post content on your behalf when you explicitly click the "Share on X" button. You can disconnect your X account at any time through your X account settings under "Apps and sessions."
              </p>
            </section>

            <Separator />

            <section>
              <h2 className="text-xl font-semibold mb-3">4. Data Storage</h2>
              <p className="text-muted-foreground">
                Your data is stored securely on our servers. Wallet addresses and transaction data are also publicly visible on the respective blockchain networks. We do not sell or share your personal information with third parties for marketing purposes.
              </p>
            </section>

            <Separator />

            <section>
              <h2 className="text-xl font-semibold mb-3">5. Cookies and Tracking</h2>
              <p className="text-muted-foreground">
                We use essential cookies and local storage to maintain your session and preferences. We do not use third-party tracking or advertising cookies.
              </p>
            </section>

            <Separator />

            <section>
              <h2 className="text-xl font-semibold mb-3">6. Your Rights</h2>
              <ul className="list-disc list-inside text-muted-foreground space-y-2">
                <li>Access your personal data stored by the Service</li>
                <li>Request deletion of your account and associated data</li>
                <li>Disconnect social media integrations at any time</li>
                <li>Opt out of promotional communications</li>
              </ul>
            </section>

            <Separator />

            <section>
              <h2 className="text-xl font-semibold mb-3">7. Security</h2>
              <p className="text-muted-foreground">
                We implement industry-standard security measures to protect your data. However, no method of transmission over the Internet is 100% secure. We encourage you to use strong passwords and secure your wallet credentials.
              </p>
            </section>

            <Separator />

            <section>
              <h2 className="text-xl font-semibold mb-3">8. Children's Privacy</h2>
              <p className="text-muted-foreground">
                The Service is not intended for users under 18 years of age. We do not knowingly collect personal information from children.
              </p>
            </section>

            <Separator />

            <section>
              <h2 className="text-xl font-semibold mb-3">9. Changes to This Policy</h2>
              <p className="text-muted-foreground">
                We may update this Privacy Policy from time to time. We will notify you of any changes by posting the new Privacy Policy on this page and updating the "Last updated" date.
              </p>
            </section>

            <Separator />

            <section>
              <h2 className="text-xl font-semibold mb-3">10. Contact Us</h2>
              <p className="text-muted-foreground">
                If you have any questions about this Privacy Policy, please contact us through our official channels.
              </p>
            </section>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
