import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Shield,
  Clock,
  DollarSign,
  Users,
  AlertTriangle,
  CheckCircle,
  Info,
  Lock,
  ArrowRight,
  FileText,
  HelpCircle
} from "lucide-react";

export default function Learn() {
  return (
    <div className="max-w-4xl mx-auto space-y-8">
      {/* Header */}
      <div className="text-center">
        <h1 className="text-3xl font-bold text-gray-900">Learn & Safety</h1>
        <p className="mt-2 text-gray-600 max-w-2xl mx-auto">
          Understand how RWA Hub works, from async deposits to security guardrails
        </p>
      </div>

      {/* Async Deposits (ERC-7540) */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="w-6 h-6 text-blue-600" />
            Async Deposits & ERC-7540
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            <p className="text-gray-600">
              RWA Hub uses ERC-7540 for asynchronous deposit and withdrawal processing, 
              which enables efficient batched execution and better price discovery.
            </p>

            {/* 3-Step Process */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="text-center">
                <div className="w-12 h-12 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center mx-auto mb-3">
                  <span className="font-bold">1</span>
                </div>
                <h3 className="font-semibold mb-2">Request</h3>
                <p className="text-sm text-gray-600">
                  Submit your deposit or withdrawal request with the desired amount
                </p>
              </div>

              <div className="text-center">
                <div className="w-12 h-12 bg-yellow-100 text-yellow-600 rounded-full flex items-center justify-center mx-auto mb-3">
                  <span className="font-bold">2</span>
                </div>
                <h3 className="font-semibold mb-2">Settlement</h3>
                <p className="text-sm text-gray-600">
                  Your request enters a queue and is executed during the next rebalance
                </p>
              </div>

              <div className="text-center">
                <div className="w-12 h-12 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-3">
                  <span className="font-bold">3</span>
                </div>
                <h3 className="font-semibold mb-2">Claim</h3>
                <p className="text-sm text-gray-600">
                  Receive your shares or assets after settlement, typically within 24-48 hours
                </p>
              </div>
            </div>

            <div className="bg-blue-50 p-4 rounded-lg">
              <div className="flex items-start gap-3">
                <Info className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
                <div>
                  <h4 className="font-medium text-blue-900 mb-1">Why Async?</h4>
                  <p className="text-sm text-blue-800">
                    Asynchronous processing allows for better price execution, reduced gas costs, 
                    and fair treatment of all investors through batched settlements.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Fee Caps */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <DollarSign className="w-6 h-6 text-green-600" />
            Fee Caps & Transparency
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <p className="text-gray-600">
              All strategies have hard-coded fee caps to protect investors from excessive charges.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="border rounded-lg p-4">
                <h4 className="font-semibold mb-2 flex items-center gap-2">
                  <Lock className="w-4 h-4 text-gray-500" />
                  Entry & Exit Fees
                </h4>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span>Entry Fee Cap:</span>
                    <Badge variant="outline">≤ 1.0%</Badge>
                  </div>
                  <div className="flex justify-between">
                    <span>Exit Fee Cap:</span>
                    <Badge variant="outline">≤ 0.5%</Badge>
                  </div>
                </div>
              </div>

              <div className="border rounded-lg p-4">
                <h4 className="font-semibold mb-2 flex items-center gap-2">
                  <Lock className="w-4 h-4 text-gray-500" />
                  Ongoing Fees
                </h4>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span>Management Fee Cap:</span>
                    <Badge variant="outline">≤ 2.0% APR</Badge>
                  </div>
                  <div className="flex justify-between">
                    <span>Performance Fee Cap:</span>
                    <Badge variant="outline">≤ 20% HWM</Badge>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-green-50 p-4 rounded-lg">
              <div className="flex items-start gap-3">
                <CheckCircle className="w-5 h-5 text-green-600 mt-0.5 flex-shrink-0" />
                <div>
                  <h4 className="font-medium text-green-900 mb-1">Fee Protection</h4>
                  <p className="text-sm text-green-800">
                    These caps are enforced at the smart contract level and cannot be changed 
                    without a timelock period and community governance.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Timelock & Governance */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="w-6 h-6 text-orange-600" />
            Timelock Security (48 Hours)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            <p className="text-gray-600">
              Critical strategy changes are protected by a 48-hour timelock, giving the community 
              time to review and respond to proposed modifications.
            </p>

            {/* Timeline */}
            <div className="relative">
              <div className="absolute left-4 top-8 bottom-8 w-0.5 bg-gray-200"></div>
              
              <div className="space-y-6">
                <div className="flex items-start gap-4">
                  <div className="w-8 h-8 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-sm font-bold">
                    T0
                  </div>
                  <div>
                    <h4 className="font-semibold">Proposal Submitted</h4>
                    <p className="text-sm text-gray-600">
                      Strategy manager submits a change proposal (fee adjustment, new assets, etc.)
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-4">
                  <div className="w-8 h-8 bg-yellow-100 text-yellow-600 rounded-full flex items-center justify-center text-sm font-bold">
                    T24
                  </div>
                  <div>
                    <h4 className="font-semibold">Community Review</h4>
                    <p className="text-sm text-gray-600">
                      24-hour period for community discussion and guardian oversight
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-4">
                  <div className="w-8 h-8 bg-green-100 text-green-600 rounded-full flex items-center justify-center text-sm font-bold">
                    T48
                  </div>
                  <div>
                    <h4 className="font-semibold">Execution Window</h4>
                    <p className="text-sm text-gray-600">
                      Changes can be executed (or cancelled by guardian if needed)
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-orange-50 p-4 rounded-lg">
              <div className="flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-orange-600 mt-0.5 flex-shrink-0" />
                <div>
                  <h4 className="font-medium text-orange-900 mb-1">Guardian Powers</h4>
                  <p className="text-sm text-orange-800">
                    During the timelock period, designated guardians can cancel malicious 
                    proposals or pause the strategy in emergency situations.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Roles & Allowlists */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="w-6 h-6 text-purple-600" />
            Roles & Contract Allowlists
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <p className="text-gray-600">
              All strategies operate with predefined contract allowlists and parameter bounds 
              to prevent unauthorized actions and limit risk exposure.
            </p>

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2">Contract</th>
                    <th className="text-left py-2">Function</th>
                    <th className="text-left py-2">Max Slippage</th>
                    <th className="text-left py-2">Max Order Size</th>
                  </tr>
                </thead>
                <tbody className="text-gray-600">
                  <tr className="border-b">
                    <td className="py-2">Uniswap V3 Router</td>
                    <td className="py-2">exactInputSingle</td>
                    <td className="py-2">80 bps</td>
                    <td className="py-2">$2,000</td>
                  </tr>
                  <tr className="border-b">
                    <td className="py-2">Curve Pool</td>
                    <td className="py-2">exchange</td>
                    <td className="py-2">100 bps</td>
                    <td className="py-2">$5,000</td>
                  </tr>
                  <tr className="border-b">
                    <td className="py-2">1inch Router</td>
                    <td className="py-2">swap</td>
                    <td className="py-2">120 bps</td>
                    <td className="py-2">$1,500</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div className="bg-purple-50 p-4 rounded-lg">
              <div className="flex items-start gap-3">
                <Shield className="w-5 h-5 text-purple-600 mt-0.5 flex-shrink-0" />
                <div>
                  <h4 className="font-medium text-purple-900 mb-1">Security Benefits</h4>
                  <p className="text-sm text-purple-800">
                    Contract allowlists prevent strategies from interacting with unvetted protocols, 
                    while parameter bounds limit the maximum impact of any single transaction.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* FAQs */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <HelpCircle className="w-6 h-6 text-indigo-600" />
            Frequently Asked Questions
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Accordion type="single" collapsible className="w-full">
            <AccordionItem value="item-1">
              <AccordionTrigger>How long do deposits take to settle?</AccordionTrigger>
              <AccordionContent>
                Deposits are typically settled within 24-48 hours, depending on the strategy's 
                rebalancing schedule. You'll receive a receipt immediately upon submitting your 
                deposit request, and can track its progress in your portfolio.
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="item-2">
              <AccordionTrigger>Can I withdraw my funds immediately?</AccordionTrigger>
              <AccordionContent>
                Like deposits, withdrawals are processed asynchronously. You can submit a withdrawal 
                request at any time, but the actual settlement will occur during the next rebalancing 
                window. Emergency exits may be available but could incur additional fees.
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="item-3">
              <AccordionTrigger>What happens if the strategy manager goes rogue?</AccordionTrigger>
              <AccordionContent>
                Multiple safety mechanisms protect against rogue behavior: (1) All critical changes 
                require a 48-hour timelock, (2) Guardians can pause strategies and cancel malicious 
                proposals, (3) Contract allowlists prevent interaction with unauthorized protocols, 
                and (4) Parameter bounds limit the impact of any single action.
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="item-4">
              <AccordionTrigger>How are fees calculated and when are they charged?</AccordionTrigger>
              <AccordionContent>
                Management fees are charged continuously based on your average balance over time. 
                Performance fees are only charged on new high-water marks and are calculated at 
                settlement. Entry and exit fees (if any) are deducted at the time of deposit/withdrawal.
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="item-5">
              <AccordionTrigger>What if the underlying assets become illiquid?</AccordionTrigger>
              <AccordionContent>
                Strategies have built-in liquidity monitoring and will automatically exclude assets 
                that fall below minimum volume thresholds. In extreme cases, the guardian can pause 
                the strategy to protect investors while alternative liquidity sources are arranged.
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="item-6">
              <AccordionTrigger>How do I know a strategy is performing as expected?</AccordionTrigger>
              <AccordionContent>
                Each strategy provides real-time performance metrics, asset breakdowns, and 
                transparency into gate conditions (trend, volume, sentiment). You can also view 
                detailed explanations of why assets are included or excluded on any given day.
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </CardContent>
      </Card>

      {/* Contact/Support */}
      <Card className="bg-gray-50">
        <CardContent className="p-6 text-center">
          <h3 className="font-semibold text-lg mb-2">Still have questions?</h3>
          <p className="text-gray-600 mb-4">
            Our team is here to help you understand how RWA Hub works
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <a 
              href="/docs" 
              className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
              <FileText className="w-4 h-4" />
              Documentation
              <ArrowRight className="w-4 h-4" />
            </a>
            <a 
              href="/discord" 
              className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
            >
              <Users className="w-4 h-4" />
              Join Community
              <ArrowRight className="w-4 h-4" />
            </a>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
