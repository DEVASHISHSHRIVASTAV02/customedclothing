"use client";

import { FormEvent, useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

export default function AdminLoginPage() {
  const router = useRouter();
  const callbackUrl = "/admin/orders";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setError(null);

    const result = await signIn("admin-credentials", {
      email,
      password,
      redirect: false,
      callbackUrl,
    });

    if (result?.error) {
      setError("Invalid admin credentials.");
      setLoading(false);
      return;
    }

    router.push(callbackUrl);
    router.refresh();
  };

  return (
    <div className="mx-auto flex w-full max-w-md px-6 py-14">
      <Card className="w-full">
        <CardHeader>
          <p className="text-xs uppercase tracking-[0.2em] text-[#000000]/60">Admin</p>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight">Sign in</h1>
        </CardHeader>
        <CardBody>
          <form onSubmit={onSubmit} className="space-y-3">
            <Input required type="email" placeholder="Admin email" value={email} onChange={(event) => setEmail(event.target.value)} />
            <Input required type="password" placeholder="Password" value={password} onChange={(event) => setPassword(event.target.value)} />
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Signing in..." : "Sign in"}
            </Button>
            {error && <p className="text-sm text-danger">{error}</p>}
          </form>
        </CardBody>
      </Card>
    </div>
  );
}




