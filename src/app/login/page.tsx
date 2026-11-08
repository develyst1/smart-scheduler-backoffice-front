"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Alert, Button, Card, PasswordInput, Stack, Text, TextInput, Title } from "@mantine/core";
import { LogIn } from "lucide-react";
import { login } from "@/services/auth.service";
import { clearToken, getClaims, safeNext, setToken } from "@/lib/auth";
import { canOpen, homeFor } from "@/lib/roles/pages";
import { ApiClientError } from "@/lib/api/client";

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password) {
      setError("กรอกชื่อผู้ใช้และรหัสผ่าน");
      return;
    }
    setError(null);
    setLoading(true);
    try {
      const res = await login(username.trim(), password);
      setToken(res.token);
      const user = getClaims();
      if (!user) throw new Error("no role in token");
      // Land on the role's home; a `next` this role may not open falls back to it.
      const next = safeNext(new URLSearchParams(window.location.search).get("next"), homeFor(user.role));
      router.replace(canOpen(user.role, next.split("?")[0]) ? next : homeFor(user.role));
    } catch (err) {
      clearToken();
      setError(err instanceof ApiClientError ? err.message : "เข้าสู่ระบบไม่สำเร็จ");
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <Card withBorder radius="lg" padding="xl" className="w-full max-w-sm bg-content1">
        <form onSubmit={submit}>
          <Stack gap="md">
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-primary/70">SOM BALANCE · BACK OFFICE</p>
              <Title order={3} mt={4}>
                เข้าสู่ระบบ
              </Title>
              <Text c="dimmed" fz="sm" mt={2}>
                ใช้ชื่อผู้ใช้และรหัสผ่านเดียวกับหน้าบ้าน
              </Text>
            </div>
            <TextInput
              label="ชื่อผู้ใช้"
              value={username}
              onChange={(e) => setUsername(e.currentTarget.value)}
              autoFocus
              required
            />
            <PasswordInput
              label="รหัสผ่าน"
              value={password}
              onChange={(e) => setPassword(e.currentTarget.value)}
              required
            />
            {error && (
              <Alert variant="light" color="red" p="xs">
                <Text fz="sm">{error}</Text>
              </Alert>
            )}
            <Button
              type="submit"
              color="orange"
              loading={loading}
              fullWidth
              leftSection={<LogIn size={16} />}
            >
              เข้าสู่ระบบ
            </Button>
          </Stack>
        </form>
      </Card>
    </div>
  );
}
