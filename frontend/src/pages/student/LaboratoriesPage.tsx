import { useQuery } from "@tanstack/react-query";
import { Search } from "lucide-react";
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";

import { laboratoryApi } from "../../api/services";
import { EmptyState } from "../../components/ui/EmptyState";
import { Input } from "../../components/ui/Input";
import { PageHeader } from "../../components/ui/PageHeader";
import { StatusBadge } from "../../components/ui/StatusBadge";
import { Card } from "../../components/ui/Card";
import { Button } from "../../components/ui/Button";

export const LaboratoriesPage = () => {
  const [search, setSearch] = useState("");
  const { data, isLoading } = useQuery({
    queryKey: ["laboratories"],
    queryFn: laboratoryApi.list
  });

  const filteredLaboratories = useMemo(() => {
    return (data ?? []).filter((laboratory) =>
      `${laboratory.name} ${laboratory.roomCode} ${laboratory.building} ${laboratory.location ?? ""}`
        .toLowerCase()
        .includes(search.toLowerCase())
    );
  }, [data, search]);

  return (
    <div>
      <PageHeader
        title="Laboratories"
        description="Explore available computer laboratories, room capacities, and room descriptions before reserving."
      />

      <div className="relative mb-6 max-w-md">
        <Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-slate-400" />
        <Input
          className="pl-10"
          placeholder="Search by laboratory name, room code, or building"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
      </div>

      {isLoading ? (
        <div>Loading laboratories...</div>
      ) : filteredLaboratories.length ? (
        <div className="grid gap-6 xl:grid-cols-2">
          {filteredLaboratories.map((laboratory) => (
            <Card key={laboratory.id} className="overflow-hidden p-0">
              <div className="h-48 bg-slate-200">
                {laboratory.imageUrl ? (
                  <img
                    className="h-full w-full object-cover"
                    src={laboratory.imageUrl}
                    alt={laboratory.name}
                  />
                ) : null}
              </div>
              <div className="p-6">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h2 className="text-xl font-semibold text-slate-900">
                      {laboratory.name}
                    </h2>
                    <p className="mt-1 text-sm text-slate-500">
                      {laboratory.roomCode} | {laboratory.building}
                    </p>
                    {laboratory.custodian ? (
                      <p className="mt-1 text-xs text-slate-400">
                        Custodian: {laboratory.custodian.firstName} {laboratory.custodian.lastName}
                      </p>
                    ) : null}
                  </div>
                  <StatusBadge status={laboratory.status} />
                </div>
                <p className="mt-4 text-sm leading-7 text-slate-500">
                  {laboratory.description}
                </p>
                <div className="mt-5 flex flex-wrap gap-3 text-sm text-slate-600">
                  <span className="rounded-full bg-slate-100 px-3 py-1">
                    Capacity: {laboratory.capacity}
                  </span>
                  <span className="rounded-full bg-slate-100 px-3 py-1">
                    Computers: {laboratory.computerCount}
                  </span>
                </div>
                <div className="mt-6 flex gap-3">
                  <Link to={`/student/laboratories/${laboratory.id}`}>
                    <Button variant="outline">View Details</Button>
                  </Link>
                  <Link to={`/student/laboratories/${laboratory.id}/reserve`}>
                    <Button>Reserve Now</Button>
                  </Link>
                </div>
              </div>
            </Card>
          ))}
        </div>
      ) : (
        <EmptyState
          title="No laboratories found"
          description="Try adjusting the search keyword or check back once more laboratory data is available."
        />
      )}
    </div>
  );
};
