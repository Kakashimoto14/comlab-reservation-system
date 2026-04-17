import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import toast from "react-hot-toast";
import { Link, useNavigate } from "react-router-dom";
import { z } from "zod";

import { Button } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import { FormField } from "../../components/ui/FormField";
import { Input } from "../../components/ui/Input";
import { useAuth } from "../../store/AuthContext";

const registerSchema = z.object({
  firstName: z.string().min(2),
  lastName: z.string().min(2),
  email: z.string().email(),
  password: z.string().min(8),
  studentNumber: z.string().min(6),
  department: z.string().min(2),
  yearLevel: z.coerce.number().min(1).max(6),
  phone: z.string().min(7)
});

type RegisterFormValues = z.infer<typeof registerSchema>;

export const RegisterPage = () => {
  const navigate = useNavigate();
  const { register: registerUser, user } = useAuth();
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting }
  } = useForm<RegisterFormValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      department: "BS Information Technology",
      yearLevel: 2
    }
  });

  useEffect(() => {
    if (!user) {
      return;
    }

    navigate(user.role === "STUDENT" ? "/student/dashboard" : "/dashboard", {
      replace: true
    });
  }, [navigate, user]);

  const onSubmit = async (values: RegisterFormValues) => {
    try {
      await registerUser(values);
      toast.success("Student account created successfully.");
      navigate("/student/dashboard", { replace: true });
    } catch (_error) {
      toast.error("Registration failed. Please review your details.");
    }
  };

  return (
    <Card className="w-full max-w-xl">
      <div className="mb-8">
        <p className="text-sm font-semibold uppercase tracking-[0.25em] text-brand-700">
          Student Registration
        </p>
        <h2 className="mt-3 font-display text-3xl font-bold text-slate-900">
          Create a laboratory reservation account
        </h2>
      </div>

      <form className="grid gap-5 md:grid-cols-2" onSubmit={handleSubmit(onSubmit)}>
        <FormField label="First Name" error={errors.firstName?.message}>
          <Input {...register("firstName")} />
        </FormField>
        <FormField label="Last Name" error={errors.lastName?.message}>
          <Input {...register("lastName")} />
        </FormField>
        <FormField label="Email" error={errors.email?.message}>
          <Input type="email" {...register("email")} />
        </FormField>
        <FormField label="Student Number" error={errors.studentNumber?.message}>
          <Input {...register("studentNumber")} />
        </FormField>
        <FormField label="Department" error={errors.department?.message}>
          <Input {...register("department")} />
        </FormField>
        <FormField label="Year Level" error={errors.yearLevel?.message}>
          <Input type="number" min={1} max={6} {...register("yearLevel", { valueAsNumber: true })} />
        </FormField>
        <FormField label="Phone Number" error={errors.phone?.message}>
          <Input {...register("phone")} />
        </FormField>
        <FormField label="Password" error={errors.password?.message}>
          <Input type="password" {...register("password")} />
        </FormField>
        <div className="md:col-span-2">
          <Button type="submit" fullWidth disabled={isSubmitting}>
            {isSubmitting ? "Creating account..." : "Register Student"}
          </Button>
        </div>
      </form>

      <p className="mt-6 text-sm text-slate-500">
        Already have an account?{" "}
        <Link className="font-semibold text-brand-700" to="/login">
          Login here
        </Link>
      </p>
    </Card>
  );
};
