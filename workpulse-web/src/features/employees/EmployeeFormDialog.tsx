import { Grid, MenuItem, TextField } from '@mui/material';
import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { z } from 'zod';
import { FormDialog } from '@/components/dialogs/FormDialog';
import { useCreateEmployeeMutation, useUpdateEmployeeMutation } from '@/services/api/employeesApi';
import { useDepartmentsQuery, useTeamsQuery } from '@/services/api/organizationApi';
import { EMPLOYMENT_STATUSES, ROLE_PROFILES, type EmployeeResponse } from '@/types/employees';
import { humanize } from '@/utils/format';

const schema = z.object({
  employeeCode: z.string().trim().min(1, 'Employee code is required').max(40),
  firstName: z.string().trim().min(1, 'First name is required').max(80),
  lastName: z.string().trim().min(1, 'Last name is required').max(80),
  workEmail: z.email('Enter a valid work email').max(255),
  designation: z.string().trim().max(120).optional(),
  departmentId: z.string().optional(),
  teamId: z.string().optional(),
  roleProfile: z.string().min(1),
  joiningDate: z.string().optional(),
  employmentStatus: z.enum(['ACTIVE', 'ON_LEAVE', 'INACTIVE', 'TERMINATED']).optional(),
});

type FormValues = z.infer<typeof schema>;

interface EmployeeFormDialogProps {
  open: boolean;
  employee?: EmployeeResponse | null;
  onClose: () => void;
  onSaved?: (employee: EmployeeResponse) => void;
}

export function EmployeeFormDialog({ open, employee, onClose, onSaved }: EmployeeFormDialogProps) {
  const editing = !!employee;
  const [create, createState] = useCreateEmployeeMutation();
  const [update, updateState] = useUpdateEmployeeMutation();
  const departments = useDepartmentsQuery();
  const { control, register, handleSubmit, reset, watch, setValue, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { employeeCode: '', firstName: '', lastName: '', workEmail: '', designation: '', departmentId: '', teamId: '', roleProfile: 'GENERAL', joiningDate: '', employmentStatus: 'ACTIVE' },
  });
  const departmentId = watch('departmentId');
  const teams = useTeamsQuery(departmentId ? { departmentId } : undefined);

  useEffect(() => {
    if (open) {
      reset({
        employeeCode: employee?.employeeCode ?? '',
        firstName: employee?.firstName ?? '',
        lastName: employee?.lastName ?? '',
        workEmail: employee?.workEmail ?? '',
        designation: employee?.designation ?? '',
        departmentId: employee?.departmentId ?? '',
        teamId: employee?.teamId ?? '',
        roleProfile: employee?.roleProfile ?? 'GENERAL',
        joiningDate: employee?.joiningDate ?? '',
        employmentStatus: employee?.employmentStatus ?? 'ACTIVE',
      });
    }
  }, [open, employee, reset]);

  const submitting = createState.isLoading || updateState.isLoading;
  const error = createState.error ?? updateState.error;

  const onSubmit = handleSubmit(async (values) => {
    const base = {
      firstName: values.firstName,
      lastName: values.lastName,
      workEmail: values.workEmail,
      designation: values.designation || undefined,
      departmentId: values.departmentId || null,
      teamId: values.teamId || null,
      joiningDate: values.joiningDate || null,
      roleProfile: values.roleProfile,
    };
    try {
      const saved = editing
        ? await update({ id: employee!.id, data: { ...base, employmentStatus: values.employmentStatus } }).unwrap()
        : await create({ ...base, employeeCode: values.employeeCode }).unwrap();
      onSaved?.(saved);
      onClose();
    } catch {
      // error rendered by the dialog
    }
  });

  return (
    <FormDialog open={open} title={editing ? `Edit ${employee?.fullName}` : 'Add employee'} submitLabel={editing ? 'Save changes' : 'Create employee'} submitting={submitting} error={error} onClose={onClose} onSubmit={onSubmit}>
      <Grid container spacing={2}>
        {!editing && (
          <Grid size={{ xs: 12, sm: 4 }}>
            <TextField label="Employee code" fullWidth required error={!!errors.employeeCode} helperText={errors.employeeCode?.message} {...register('employeeCode')} />
          </Grid>
        )}
        <Grid size={{ xs: 12, sm: editing ? 6 : 4 }}>
          <TextField label="First name" fullWidth required error={!!errors.firstName} helperText={errors.firstName?.message} {...register('firstName')} />
        </Grid>
        <Grid size={{ xs: 12, sm: editing ? 6 : 4 }}>
          <TextField label="Last name" fullWidth required error={!!errors.lastName} helperText={errors.lastName?.message} {...register('lastName')} />
        </Grid>
        <Grid size={{ xs: 12, sm: 7 }}>
          <TextField label="Work email" type="email" fullWidth required error={!!errors.workEmail} helperText={errors.workEmail?.message} {...register('workEmail')} />
        </Grid>
        <Grid size={{ xs: 12, sm: 5 }}>
          <TextField label="Designation" fullWidth error={!!errors.designation} helperText={errors.designation?.message} {...register('designation')} />
        </Grid>
        <Grid size={{ xs: 12, sm: 6 }}>
          <Controller
            name="departmentId"
            control={control}
            render={({ field }) => (
              <TextField select label="Department" fullWidth value={field.value ?? ''} onChange={(e) => { field.onChange(e.target.value); setValue('teamId', ''); }}>
                <MenuItem value="">No department</MenuItem>
                {(departments.data ?? []).map((d) => (
                  <MenuItem key={d.id} value={d.id}>
                    {d.name}
                  </MenuItem>
                ))}
              </TextField>
            )}
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 6 }}>
          <Controller
            name="teamId"
            control={control}
            render={({ field }) => (
              <TextField select label="Team" fullWidth value={field.value ?? ''} onChange={field.onChange} disabled={!departmentId}>
                <MenuItem value="">No team</MenuItem>
                {(teams.data ?? []).map((t) => (
                  <MenuItem key={t.id} value={t.id}>
                    {t.name}
                  </MenuItem>
                ))}
              </TextField>
            )}
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 4 }}>
          <Controller
            name="roleProfile"
            control={control}
            render={({ field }) => (
              <TextField select label="Role profile" fullWidth value={field.value} onChange={field.onChange} helperText="Drives application classification">
                {ROLE_PROFILES.map((p) => (
                  <MenuItem key={p} value={p}>
                    {humanize(p)}
                  </MenuItem>
                ))}
              </TextField>
            )}
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 4 }}>
          <TextField label="Joining date" type="date" fullWidth slotProps={{ inputLabel: { shrink: true } }} {...register('joiningDate')} />
        </Grid>
        {editing && (
          <Grid size={{ xs: 12, sm: 4 }}>
            <Controller
              name="employmentStatus"
              control={control}
              render={({ field }) => (
                <TextField select label="Employment status" fullWidth value={field.value ?? 'ACTIVE'} onChange={field.onChange}>
                  {EMPLOYMENT_STATUSES.map((s) => (
                    <MenuItem key={s} value={s}>
                      {humanize(s)}
                    </MenuItem>
                  ))}
                </TextField>
              )}
            />
          </Grid>
        )}
      </Grid>
    </FormDialog>
  );
}
