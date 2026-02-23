"use client";

import { use, useState } from "react";
import Link from "next/link";
import { trpc } from "@/lib/trpc/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  ArrowLeft,
  GitPullRequest,
  GitMerge,
  ExternalLink,
  Clock,
  Plus,
  Minus,
  FileText,
  XCircle,
  CheckCircle,
  Loader2,
  Sparkles,
  GitBranch,
  ArrowRight,
  Wand2,
  ScanSearch,
} from "lucide-react";
import { cn } from "@/lib/utils";


type PageProps = {
  params: Promise<{ id: string; prNumber: string }>;
};

export default function PullRequestDetailPage({ params }: PageProps) {
  const { id, prNumber } = use(params);
  const prNum = parseInt(prNumber, 10);
  const [activeTab, setActiveTab] = useState<"review" | "files">("review");

  const pr = trpc.pullRequest.get.useQuery(
    { repositoryId: id, prNumber: prNum },
    { enabled: !isNaN(prNum) },
  );

  if (pr.isLoading) {
    return (
      <div className="space-y-8">
        <div className="flex items-center gap-4">
          <Skeleton className="size-10 rounded-lg" />
          <div className="space-y-2">
            <Skeleton className="h-7 w-96" />
            <Skeleton className="h-4 w-64" />
          </div>
        </div>
        <Skeleton className="h-24 w-full rounded-xl" />
        <Skeleton className="h-64 w-full rounded-xl" />
      </div>
    );
  }

  if (pr.error || !pr.data) {
    return (
      <Card>
        <CardContent className="py-16 text-center">
          <div className="mx-auto size-12 rounded-full bg-destructive/10 flex items-center justify-center">
            <XCircle className="size-6 text-destructive" />
          </div>
          <p className="mt-4 font-medium text-destructive">
            {pr.error?.message ?? "Pull Request not found"}
          </p>
          <Link href={`/repos/${id}`} className="mt-6 inline-block">
            <Button variant={"outline"}>
              <ArrowLeft className="size-4" />
              Back to Repository
            </Button>
          </Link>
        </CardContent>
      </Card>
    );
  }

  const isMerged = pr.data.state === "closed" && pr.data.mergedAt;

  const files = trpc.pullRequest.files.useQuery(
    { repositoryId: id, prNumber: prNum },
    { enabled: !isNaN(prNum) },
  );



  return (
    <div className="space-y-8">
      <div className="flex items-start gap-4">
        <Link href={`/repos/${id}`}>
          <Button
            variant={"outline"}
            size={"icon"}
            className="shrink-0 mt-1"
          >
            <ArrowLeft className="size-4" />
          </Button>
        </Link>

        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="flex items-center gap-3 flex-wrap">

              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

  )

}