import apiClient, { sendQuery } from '../../services/api';

describe('Frontend API Client Service', () => {
  it('sends query payload correctly to backend /query endpoint', async () => {
    const mockPost = jest.spyOn(apiClient, 'post').mockResolvedValueOnce({
      data: {
        answer: 'The Reynolds number formula is Re = rho * v * L / mu',
        citations: [],
        model_used: 'gemini-2.5-flash',
        retrieved_chunks_count: 5
      }
    });

    const res = await sendQuery('What is Reynolds number?', 'Fluid Mechanics');
    expect(res.answer).toContain('Reynolds number formula');
    expect(mockPost).toHaveBeenCalledWith('/query', {
      query: 'What is Reynolds number?',
      book_filter: 'Fluid Mechanics',
      model_name: undefined
    });
  });
});
