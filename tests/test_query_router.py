from app.services.query_router import QueryRouterService
from app.services.prompt_builder import PromptBuilderService

def test_query_router_heuristic_greetings():
    router = QueryRouterService()
    
    assert router.classify_intent("hi") == "DIRECT_ANSWER"
    assert router.classify_intent("Hello!") == "DIRECT_ANSWER"
    assert router.classify_intent("hey there") == "DIRECT_ANSWER"
    assert router.classify_intent("good morning") == "DIRECT_ANSWER"
    assert router.classify_intent("thank you so much") == "DIRECT_ANSWER"
    print("✓ test_query_router_heuristic_greetings passed!")

def test_prompt_builder_direct_messages():
    builder = PromptBuilderService()
    history = [
        {"role": "user", "content": "What is the continuity equation?"},
        {"role": "assistant", "content": "The continuity equation in differential form is $\\frac{\\partial \\rho}{\\partial t} + \\nabla \\cdot (\\rho \\mathbf{V}) = 0$."}
    ]
    messages = builder.build_direct_chat_messages(
        query="what does rho stand for?",
        history=history
    )
    
    assert len(messages) == 4
    assert messages[0].content.startswith("You are an expert Mechanical Engineering AI Assistant")
    assert messages[1].content == "What is the continuity equation?"
    assert "continuity equation" in messages[2].content
    assert messages[3].content == "what does rho stand for?"
    print("✓ test_prompt_builder_direct_messages passed!")

def test_query_router_intent_classification():
    router = QueryRouterService()
    
    # 1. Greetings / Pleasantries
    assert router.classify_intent("hi") == "DIRECT_ANSWER"
    assert router.classify_intent("good afternoon") == "DIRECT_ANSWER"
    
    # 2. Textbook technical question (new topic)
    intent_tech = router.classify_intent("State the Navier-Stokes equations in cylindrical coordinates.")
    assert intent_tech == "RETRIEVAL_NEEDED"
    print(f"✓ Technical query classified as: {intent_tech}")
    
    # 3. Follow up question with chat history
    history = [
        {"role": "user", "content": "What is the formula for Reynolds number?"},
        {"role": "assistant", "content": "The Reynolds number is defined as $Re = \\frac{\\rho V D}{\\mu}$, where $\\rho$ is density, $V$ is velocity, $D$ is hydraulic diameter, and $\\mu$ is dynamic viscosity."}
    ]
    intent_followup = router.classify_intent("can you simplify the numerator if density is 1?", history=history)
    assert intent_followup == "DIRECT_ANSWER"
    print(f"✓ Follow-up query classified as: {intent_followup}")

def test_rag_engine_greeting_no_citations():
    from app.services.rag_engine import RAGEngine
    engine = RAGEngine()
    res = engine.query(query_text="hi")
    
    assert res.query == "hi"
    assert len(res.citations) == 0
    assert len(res.answer.strip()) > 0
    print(f"✓ RAGEngine greeting response received with 0 citations: '{res.answer.strip()[:60]}...'")

if __name__ == "__main__":
    test_query_router_heuristic_greetings()
    test_prompt_builder_direct_messages()
    test_query_router_intent_classification()
    test_rag_engine_greeting_no_citations()
    print("\nAll query router and RAG engine tests passed successfully!")
