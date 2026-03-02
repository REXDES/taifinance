
-- Create a trigger function to automatically add creator to user_companies
CREATE OR REPLACE FUNCTION public.auto_add_creator_to_company()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.created_by IS NOT NULL THEN
    INSERT INTO public.user_companies (user_id, company_id)
    VALUES (NEW.created_by, NEW.id)
    ON CONFLICT DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;

-- Create the trigger on companies table
CREATE TRIGGER auto_add_creator_to_company_trigger
AFTER INSERT ON public.companies
FOR EACH ROW
EXECUTE FUNCTION public.auto_add_creator_to_company();
