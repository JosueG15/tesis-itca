import { useMemo } from 'react';
import { useMyApplications } from './useOpportunities';
import { ApplicationStatusValues } from '@/types/opportunity.types';

export function useHasAcceptedApplication() {
  const { data: applicationsData } = useMyApplications({
    page: 1,
    limit: 100,
  });

  const hasAcceptedApplication = useMemo(() => {
    const applications = applicationsData?.data || [];
    return applications.some(
      (app) => app.status === ApplicationStatusValues.ACCEPTED,
    );
  }, [applicationsData?.data]);

  return hasAcceptedApplication;
}

