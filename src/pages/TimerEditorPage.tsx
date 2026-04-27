import { Navigate, useParams } from 'react-router-dom';

export const TimerEditorPage = () => {
  const { id = '' } = useParams();
  return <Navigate to={`/timer/${id}`} replace />;
};
