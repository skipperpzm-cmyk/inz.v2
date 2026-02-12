-- Enable Row Level Security for profiles table
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Policy: Allow update only for authenticated users and service_role, if user updates their own profile
CREATE POLICY "Enable update for authenticated users only"
ON public.profiles
AS PERMISSIVE
FOR UPDATE
TO authenticated, service_role
USING (
  auth.uid() = id
)
WITH CHECK (
  auth.uid() = id
);
