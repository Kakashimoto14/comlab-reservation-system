import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { AxiosError } from "axios";

import { laboratoryApi } from "../../api/services";
import { Card } from "../../components/ui/Card";
import { EmptyState } from "../../components/ui/EmptyState";
import { Input } from "../../components/ui/Input";
import { PageHeader } from "../../components/ui/PageHeader";
import { Select } from "../../components/ui/Select";
import { StatusBadge } from "../../components/ui/StatusBadge";
import type { Laboratory, User } from "../../types/api";

const getErrorMessage = (error: unknown, fallbackMessage: string) => {
  if (error instanceof AxiosError) {
    return (error.response?.data as { message?: string } | undefined)?.message ?? fallbackMessage;
  }

  return fallbackMessage;
};

const getStaffLabel = (
  staff?:
    | Pick<User, "id" | "firstName" | "lastName" | "email" | "department" | "role" | "status">
    | null
) =>
  staff ? `${staff.lastName}, ${staff.firstName}` : "Unassigned";

export const LaboratoryStaffAssignmentPage = () => {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [buildingFilter, setBuildingFilter] = useState("");
  const [departmentFilter, setDepartmentFilter] = useState("");

  const { data: assignments, isLoading } = useQuery({
    queryKey: ["laboratory-assignments", buildingFilter, departmentFilter],
    queryFn: () =>
      laboratoryApi.listAssignments({
        building: buildingFilter || undefined,
        department: departmentFilter || undefined
      })
  });

  const { data: staffOptions } = useQuery({
    queryKey: ["laboratory-staff-options"],
    queryFn: laboratoryApi.listStaffOptions
  });

  const assignmentMutation = useMutation({
    mutationFn: ({ laboratoryId, custodianId }: { laboratoryId: number; custodianId: number | null }) =>
      laboratoryApi.assignStaff(laboratoryId, custodianId),
    onSuccess: async () => {
      toast.success("Laboratory assignment updated.");
      await queryClient.invalidateQueries({ queryKey: ["laboratory-assignments"] });
      await queryClient.invalidateQueries({ queryKey: ["laboratories"] });
    },
    onError: (error) => toast.error(getErrorMessage(error, "Unable to update the staff assignment."))
  });

  const buildings = useMemo(
    () =>
      Array.from(new Set((assignments ?? []).map((laboratory) => laboratory.building))).sort(
        (left, right) => left.localeCompare(right)
      ),
    [assignments]
  );

  const departments = useMemo(
    () =>
      Array.from(
        new Set(
          (staffOptions ?? [])
            .map((staff) => staff.department)
            .filter((value): value is string => Boolean(value))
        )
      ).sort((left, right) => left.localeCompare(right)),
    [staffOptions]
  );

  const filteredAssignments = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();

    return (assignments ?? []).filter((laboratory) => {
      if (!normalizedSearch) {
        return true;
      }

      return [
        laboratory.name,
        laboratory.roomCode,
        laboratory.building,
        laboratory.location,
        laboratory.custodian?.firstName,
        laboratory.custodian?.lastName
      ]
        .filter(Boolean)
        .some((value) => value?.toLowerCase().includes(normalizedSearch));
    });
  }, [assignments, search]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Assign Staff"
        description="Assign, reassign, and unassign laboratory custodians without changing existing laboratory records."
      />

      <Card>
        <div className="grid gap-4 lg:grid-cols-[1.2fr_repeat(2,minmax(0,1fr))]">
          <div>
            <label className="text-sm font-medium text-slate-700">Search</label>
            <Input
              className="mt-2"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search by laboratory, room code, or assigned staff"
            />
          </div>
          <div>
            <label className="text-sm font-medium text-slate-700">Building</label>
            <Select
              className="mt-2"
              value={buildingFilter}
              onChange={(event) => setBuildingFilter(event.target.value)}
            >
              <option value="">All buildings</option>
              {buildings.map((building) => (
                <option key={building} value={building}>
                  {building}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <label className="text-sm font-medium text-slate-700">Department</label>
            <Select
              className="mt-2"
              value={departmentFilter}
              onChange={(event) => setDepartmentFilter(event.target.value)}
            >
              <option value="">All departments</option>
              {departments.map((department) => (
                <option key={department} value={department}>
                  {department}
                </option>
              ))}
            </Select>
          </div>
        </div>
      </Card>

      <Card>
        {isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 6 }).map((_, index) => (
              <div key={index} className="h-20 animate-pulse rounded-2xl bg-slate-100" />
            ))}
          </div>
        ) : filteredAssignments.length ? (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead>
                <tr className="text-left text-slate-500">
                  <th className="py-3 pr-4">Laboratory</th>
                  <th className="py-3 pr-4">Location</th>
                  <th className="py-3 pr-4">Current Custodian</th>
                  <th className="py-3 pr-4">Status</th>
                  <th className="py-3">Assignment</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredAssignments.map((laboratory: Laboratory) => (
                  <tr key={laboratory.id}>
                    <td className="py-4 pr-4">
                      <p className="font-semibold text-slate-900">{laboratory.name}</p>
                      <p className="mt-1 text-slate-500">{laboratory.roomCode}</p>
                    </td>
                    <td className="py-4 pr-4">
                      <p>{laboratory.building}</p>
                      <p className="mt-1 text-slate-500">{laboratory.location ?? "Not specified"}</p>
                    </td>
                    <td className="py-4 pr-4">
                      <p className="font-medium text-slate-800">{getStaffLabel(laboratory.custodian)}</p>
                      <p className="mt-1 text-slate-500">
                        {laboratory.custodian?.department ?? "No department"}
                      </p>
                    </td>
                    <td className="py-4 pr-4">
                      <div className="flex flex-col gap-2">
                        <StatusBadge status={laboratory.status} />
                        <span className="text-xs text-slate-500">
                          {laboratory.custodian ? "Assigned" : "Needs assignment"}
                        </span>
                      </div>
                    </td>
                    <td className="py-4">
                      <Select
                        value={laboratory.custodianId ?? ""}
                        onChange={(event) =>
                          assignmentMutation.mutate({
                            laboratoryId: laboratory.id,
                            custodianId: event.target.value ? Number(event.target.value) : null
                          })
                        }
                        disabled={assignmentMutation.isPending}
                      >
                        <option value="">Unassigned</option>
                        {staffOptions?.map((staff) => (
                          <option key={staff.id} value={staff.id}>
                            {staff.lastName}, {staff.firstName}
                            {staff.department ? ` - ${staff.department}` : ""}
                          </option>
                        ))}
                      </Select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState
            title="No laboratories match the current filters"
            description="Adjust the building or department filter to review more laboratory assignments."
          />
        )}
      </Card>
    </div>
  );
};
